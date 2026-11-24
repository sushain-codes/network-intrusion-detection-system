const mongoose = require('mongoose');
const mlService = require('../services/ml.service');
const Prediction = require('../models/Prediction');

/**
 * Basic payload validation: ensure request body is present and not empty.
 * Full 42-feature schema validation is delegated to the ML service contract.
 */
const validateFeaturePayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a valid JSON object containing network traffic features.';
  }

  // Handle both flat { dur: ..., proto: ... } and wrapped { features: { ... } }
  const features = body.features && typeof body.features === 'object' ? body.features : body;
  if (Object.keys(features).length === 0) {
    return 'Network features payload cannot be empty. Please provide network traffic attributes.';
  }

  return null;
};

/**
 * @desc    Predict network intrusion using the two-stage XGBoost architecture and persist to history
 * @route   POST /api/predictions
 * @access  Private (JWT Protected)
 */
const createPrediction = async (req, res) => {
  try {
    const validationError = validateFeaturePayload(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const rawFeatures = req.body.features && typeof req.body.features === 'object'
      ? req.body.features
      : req.body;

    // 1. Call FastAPI ML service to get hierarchical two-stage prediction
    const result = await mlService.predictTwoStage(rawFeatures);

    // 2. Extract complete two-stage fields
    const attackCategory = result.attack_category || result.prediction;
    const confidence = result.confidence;
    const isAttack = result.is_attack !== undefined
      ? Boolean(result.is_attack)
      : (attackCategory.toLowerCase() !== 'normal');
    const routingPath = result.routing_path || (isAttack ? 'stage1_and_stage2' : 'stage1_only');
    const stage1Binary = result.stage1_binary || null;
    const stage2Multiclass = result.stage2_multiclass || null;

    // Determine probabilities:
    // If Stage 2 executed (malicious), persist the 10-class probability distribution
    // If Stage 2 was bypassed (normal), persist binary probability distribution
    let probabilities = {};
    if (stage2Multiclass && stage2Multiclass.probabilities) {
      probabilities = stage2Multiclass.probabilities;
    } else if (stage1Binary && stage1Binary.attack_probability !== undefined) {
      const attackProb = stage1Binary.attack_probability;
      const normalProb = Number((1 - attackProb).toFixed(6));
      probabilities = {
        Normal: normalProb,
        Attack: Number(attackProb.toFixed(6)),
      };
    }

    // 3. Save complete prediction record to MongoDB linked to authenticated user
    const savedPrediction = await Prediction.create({
      userId: req.user._id,
      isAttack,
      attackCategory,
      confidence,
      routingPath,
      stage1Binary,
      stage2Multiclass,
      probabilities,
      inputFeatures: rawFeatures,
    });

    // 4. Return response with complete two-stage details, prediction ID, and timestamps
    return res.status(200).json({
      success: true,
      data: {
        ...result,
        predictionId: savedPrediction._id,
        _id: savedPrediction._id,
        isAttack,
        is_attack: isAttack,
        attackCategory,
        attack_category: attackCategory,
        routingPath,
        routing_path: routingPath,
        stage1Binary,
        stage1_binary: stage1Binary,
        stage2Multiclass,
        stage2_multiclass: stage2Multiclass,
        probabilities,
        createdAt: savedPrediction.createdAt,
        updatedAt: savedPrediction.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error in createPrediction:', error.message);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'An error occurred while generating prediction.',
      details: error.details || undefined,
    });
  }
};

/**
 * @desc    Retrieve paginated prediction history for the authenticated user (newest first, excluding inputFeatures)
 * @route   GET /api/predictions/history
 * @access  Private (JWT Protected)
 */
const getPredictionHistory = async (req, res) => {
  try {
    // 1. Validate query parameters
    let page = 1;
    let limit = 10;

    if (req.query.page !== undefined) {
      const parsedPage = Number(req.query.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page query parameter must be a positive integer greater than or equal to 1.',
        });
      }
      page = parsedPage;
    }

    if (req.query.limit !== undefined) {
      const parsedLimit = Number(req.query.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit query parameter must be an integer between 1 and 100.',
        });
      }
      limit = parsedLimit;
    }

    const skip = (page - 1) * limit;

    // 2. Strict user isolation: query ONLY for logged-in user's records
    const filter = { userId: req.user._id };

    // 3. Query predictions (excluding inputFeatures) and total count in parallel
    const [predictions, total] = await Promise.all([
      Prediction.find(filter)
        .select('-inputFeatures')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Prediction.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 0;

    return res.status(200).json({
      success: true,
      data: {
        predictions,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error in getPredictionHistory:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving prediction history.',
    });
  }
};

/**
 * @desc    Retrieve individual prediction details by ID (including full inputFeatures)
 * @route   GET /api/predictions/:id
 * @access  Private (JWT Protected)
 */
const getPredictionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format (24-character hex string)
    if (!mongoose.Types.ObjectId.isValid(id) || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid prediction ID format. Must be a 24-character hexadecimal string.',
      });
    }

    // Fetch prediction using both _id and userId for strict owner verification
    const prediction = await Prediction.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Prediction not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('Error in getPredictionById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving prediction details.',
    });
  }
};

/**
 * @desc    Get user-specific dashboard analytics (aggregated metrics, distribution, timeline)
 * @route   GET /api/predictions/analytics
 * @access  Private (JWT Protected)
 */
const getPredictionAnalytics = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);

    const [aggregated] = await Prediction.aggregate([
      {
        $match: { userId: userObjectId },
      },
      {
        $facet: {
          // 1. Overall totals, averages, and traffic split
          summary: [
            {
              $group: {
                _id: null,
                totalPredictions: { $sum: 1 },
                avgConfidence: { $avg: '$confidence' },
                normalCount: {
                  $sum: {
                    $cond: [
                      { $eq: [{ $toLower: '$attackCategory' }, 'normal'] },
                      1,
                      0,
                    ],
                  },
                },
                maliciousCount: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $toLower: '$attackCategory' }, 'normal'] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          // 2. Attack category distribution (sorted by volume descending)
          categoryDistribution: [
            {
              $group: {
                _id: '$attackCategory',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1, _id: 1 } },
          ],
          // 3. Chronological timeline activity grouped by date
          timeline: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                total: { $sum: 1 },
                normal: {
                  $sum: {
                    $cond: [
                      { $eq: [{ $toLower: '$attackCategory' }, 'normal'] },
                      1,
                      0,
                    ],
                  },
                },
                malicious: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $toLower: '$attackCategory' }, 'normal'] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          // 4. Most recent predictions feed
          recentPredictions: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                attackCategory: 1,
                confidence: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const summaryRaw = (aggregated && aggregated.summary && aggregated.summary[0]) || null;

    const totalPredictions = summaryRaw ? summaryRaw.totalPredictions : 0;
    const normalCount = summaryRaw ? summaryRaw.normalCount : 0;
    const maliciousCount = summaryRaw ? summaryRaw.maliciousCount : 0;
    const avgConfidenceRaw = summaryRaw ? summaryRaw.avgConfidence : 0;

    const normalPercentage = totalPredictions > 0
      ? Number(((normalCount / totalPredictions) * 100).toFixed(2))
      : 0;
    const maliciousPercentage = totalPredictions > 0
      ? Number(((maliciousCount / totalPredictions) * 100).toFixed(2))
      : 0;
    const averageConfidence = totalPredictions > 0
      ? Number(Number(avgConfidenceRaw).toFixed(4))
      : 0;

    const categoryDistribution = (aggregated && aggregated.categoryDistribution
      ? aggregated.categoryDistribution
      : []
    ).map((item) => ({
      category: item._id,
      count: item.count,
      percentage: totalPredictions > 0
        ? Number(((item.count / totalPredictions) * 100).toFixed(2))
        : 0,
    }));

    const timeline = (aggregated && aggregated.timeline
      ? aggregated.timeline
      : []
    ).map((item) => ({
      date: item._id,
      total: item.total,
      normal: item.normal,
      malicious: item.malicious,
    }));

    const recentActivity = (aggregated && aggregated.recentPredictions
      ? aggregated.recentPredictions
      : []
    ).map((item) => ({
      _id: item._id,
      attackCategory: item.attackCategory,
      attack_category: item.attackCategory,
      confidence: item.confidence,
      createdAt: item.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalPredictions,
          normalCount,
          maliciousCount,
          normalPercentage,
          maliciousPercentage,
          averageConfidence,
        },
        trafficBreakdown: {
          normal: normalCount,
          malicious: maliciousCount,
        },
        categoryDistribution,
        timeline,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Error in getPredictionAnalytics:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while calculating prediction analytics.',
    });
  }
};

/**
 * @desc    Generate local SHAP feature contributions
 *          - If predictionId is provided, checks saved MongoDB record to decide Stage 1 (Binary) or Stage 2 (Multiclass)
 *          - If raw features provided without predictionId, evaluates flow to auto-select Stage 1 or Stage 2,
 *            or respects explicit explanationType ('binary' | 'multiclass').
 * @route   POST /api/predictions/explain
 * @access  Private (JWT Protected)
 */
const explainPrediction = async (req, res) => {
  try {
    const { predictionId, explanationType, features: nestedFeatures } = req.body;
    let targetFeatures = null;
    let selectedType = explanationType || null; // 'binary' | 'multiclass'
    let predictionRecord = null;

    // Case 1: Stored prediction ID provided
    if (predictionId) {
      if (!mongoose.Types.ObjectId.isValid(predictionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid prediction ID format. Must be a 24-character hexadecimal string.',
        });
      }

      predictionRecord = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id,
      });

      if (!predictionRecord) {
        return res.status(404).json({
          success: false,
          message: 'Prediction not found.',
        });
      }

      targetFeatures = predictionRecord.inputFeatures;
      if (!targetFeatures) {
        return res.status(400).json({
          success: false,
          message: 'Stored prediction does not contain inputFeatures.',
        });
      }

      // If user did not force explanationType, auto-select based on saved prediction:
      // If Normal traffic (stage1_only), explain Stage 1 (Binary SHAP)
      // If Attack traffic (stage1_and_stage2), explain Stage 2 (Multiclass SHAP)
      if (!selectedType) {
        selectedType = (predictionRecord.isAttack === false || predictionRecord.attackCategory.toLowerCase() === 'normal')
          ? 'binary'
          : 'multiclass';
      }
    } else {
      // Case 2: Direct raw features provided
      targetFeatures = nestedFeatures && typeof nestedFeatures === 'object'
        ? nestedFeatures
        : req.body;

      const validationError = validateFeaturePayload(targetFeatures);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      // Auto-select type if not explicitly set
      if (!selectedType) {
        const twoStage = await mlService.predictTwoStage(targetFeatures);
        selectedType = twoStage.is_attack === false ? 'binary' : 'multiclass';
      }
    }

    // Execute the selected SHAP explanation
    let explanationData;
    if (selectedType === 'binary') {
      const binExp = await mlService.explainBinaryLocal(targetFeatures);
      explanationData = {
        ...binExp,
        explanation_type: 'binary_stage1',
        explanationType: 'binary_stage1',
        predicted_class: binExp.prediction || 'Normal',
        confidence: 1 - (binExp.attack_probability || 0),
        units: binExp.units || 'raw log-odds margin contributions (additive in logit space: margin = base_value + sum(SHAP), P = sigmoid(margin)); not probabilities',
        metric_type: 'log_odds_margin',
        is_attack: binExp.is_attack !== undefined ? binExp.is_attack : false,
        routing_path: 'stage1_only',
      };
    } else {
      const mcExp = await mlService.explainLocal(targetFeatures);
      explanationData = {
        ...mcExp,
        explanation_type: 'multiclass_stage2',
        explanationType: 'multiclass_stage2',
        is_attack: true,
        routing_path: 'stage1_and_stage2',
      };
    }

    return res.status(200).json({
      success: true,
      data: explanationData,
    });
  } catch (error) {
    console.error('Error in explainPrediction:', error.message);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'An error occurred while explaining prediction.',
      details: error.details || undefined,
    });
  }
};

/**
 * @desc    Explicitly generate binary SHAP explanation (Stage 1)
 * @route   POST /api/predictions/explain/binary
 * @access  Private (JWT Protected)
 */
const explainBinaryPrediction = async (req, res) => {
  req.body.explanationType = 'binary';
  return explainPrediction(req, res);
};

/**
 * @desc    Explicitly generate multiclass SHAP explanation (Stage 2)
 * @route   POST /api/predictions/explain/multiclass
 * @access  Private (JWT Protected)
 */
const explainMulticlassPrediction = async (req, res) => {
  req.body.explanationType = 'multiclass';
  return explainPrediction(req, res);
};

/**
 * @desc    Fetch top 20 global SHAP feature importances for multiclass model
 * @route   GET /api/predictions/global-explanations
 * @access  Private (JWT Protected)
 */
const getGlobalExplanations = async (req, res) => {
  try {
    const result = await mlService.getGlobalExplanations();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in getGlobalExplanations:', error.message);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'An error occurred while fetching global explanations.',
      details: error.details || undefined,
    });
  }
};

/**
 * @desc    Fetch top 20 global feature importances for binary model
 * @route   GET /api/predictions/explain/binary/global
 * @access  Private (JWT Protected)
 */
const getBinaryGlobalExplanations = async (req, res) => {
  try {
    const result = await mlService.getBinaryGlobalExplanations();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in getBinaryGlobalExplanations:', error.message);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'An error occurred while fetching binary global explanations.',
      details: error.details || undefined,
    });
  }
};

module.exports = {
  createPrediction,
  getPredictionHistory,
  getPredictionById,
  getPredictionAnalytics,
  explainPrediction,
  explainBinaryPrediction,
  explainMulticlassPrediction,
  getGlobalExplanations,
  getBinaryGlobalExplanations,
};

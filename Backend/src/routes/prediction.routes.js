const express = require('express');
const router = express.Router();

const {
  createPrediction,
  getPredictionHistory,
  getPredictionById,
  getPredictionAnalytics,
  explainPrediction,
  explainBinaryPrediction,
  explainMulticlassPrediction,
  getGlobalExplanations,
  getBinaryGlobalExplanations,
} = require('../controllers/prediction.controller');
const { protect } = require('../middleware/auth.middleware');

// Protect all prediction, history, analytics, and explainability routes
router.use(protect);

// GET /api/predictions/analytics — retrieve user-specific dashboard analytics
router.get('/analytics', getPredictionAnalytics);

// GET /api/predictions/history — retrieve paginated prediction history for logged-in user
router.get('/history', getPredictionHistory);

// GET /api/predictions/global-explanations — top 20 global feature importances (multiclass)
router.get('/global-explanations', getGlobalExplanations);

// GET /api/predictions/explain/binary/global — top 20 global feature importances (binary)
router.get('/explain/binary/global', getBinaryGlobalExplanations);

// POST /api/predictions/explain/binary — explicit binary local SHAP explanation
router.post('/explain/binary', explainBinaryPrediction);

// POST /api/predictions/explain/multiclass — explicit multiclass local SHAP explanation
router.post('/explain/multiclass', explainMulticlassPrediction);

// POST /api/predictions/explain — local SHAP explanation (auto-selects Stage 1 or Stage 2)
router.post('/explain', explainPrediction);

// GET /api/predictions/:id — retrieve individual prediction details by ID
router.get('/:id', getPredictionById);

// POST /api/predictions — predict attack category and save to history
router.post('/', createPrediction);

module.exports = router;

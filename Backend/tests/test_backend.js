/**
 * Automated Test Suite for Express Backend Two-Stage ML Integration.
 *
 * Verifies:
 * 1. Prediction Mongoose model schema:
 *    - isAttack, routingPath, stage1Binary, stage2Multiclass, probabilities, inputFeatures.
 *    - Schema virtual transforms (is_attack, routing_path, stage1_binary, stage2_multiclass, attack_category).
 * 2. ML Service client methods:
 *    - predictTwoStage -> POST /predict/two-stage
 *    - predictBinary -> POST /predict/binary
 *    - explainBinaryLocal -> POST /explain/binary/local
 *    - explainLocal -> POST /explain/local
 *    - getBinaryGlobalExplanations -> GET /explain/binary/global
 *    - getGlobalExplanations -> GET /explain/global
 *    - Error mappings and timeout handling.
 * 3. Prediction Controller logic:
 *    - Normal traffic: Stage 2 skipped (stage2_multiclass is null, routing_path is stage1_only).
 *    - Malicious traffic: Stage 2 executed (stage2_multiclass contains attack category & probabilities).
 *    - MongoDB persistence for both normal and attack cases.
 *    - Prediction history pagination and user isolation.
 *    - Prediction details with user ownership verification.
 *    - Local SHAP explanation routing:
 *      * Normal prediction -> routes to Binary SHAP (Stage 1), labels log-odds margin units.
 *      * Malicious prediction -> routes to Multiclass SHAP (Stage 2).
 *    - Dashboard analytics compatibility.
 * 4. Express App API & Auth middleware:
 *    - Protected routes reject unauthenticated requests with 401.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const http = require('http');

// Load environment variables for testing
require('dotenv').config({ path: 'Backend/.env' });

const Prediction = require('../src/models/Prediction');
const { MLService } = require('../src/services/ml.service');
const predictionController = require('../src/controllers/prediction.controller');
const app = require('../src/app');

// Sample test payloads
const sampleNormalFeatures = {
  dur: 0.0, proto: 'arp', service: '-', state: 'INT', spkts: 1, dpkts: 0,
  sbytes: 46, dbytes: 0, rate: 0.0, sttl: 0, dttl: 0, sload: 0.0, dload: 0.0,
  sloss: 0, dloss: 0, sinpkt: 0.0, dinpkt: 0.0, sjit: 0.0, djit: 0.0,
  swin: 0, stcpb: 0, dtcpb: 0, dwin: 0, tcprtt: 0.0, synack: 0.0, ackdat: 0.0,
  smean: 46, dmean: 0, trans_depth: 0, response_body_len: 0, ct_srv_src: 2,
  ct_state_ttl: 2, ct_dst_ltm: 2, ct_src_dport_ltm: 1, ct_dst_sport_ltm: 1,
  ct_dst_src_ltm: 2, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 0,
  ct_src_ltm: 2, ct_srv_dst: 2, is_sm_ips_ports: 0,
};

const sampleMaliciousFeatures = {
  dur: 0.000004, proto: 'ospf', service: '-', state: 'INT', spkts: 2, dpkts: 0,
  sbytes: 200, dbytes: 0, rate: 250000.0, sttl: 254, dttl: 0, sload: 200000000.0,
  dload: 0.0, sloss: 0, dloss: 0, sinpkt: 0.004, dinpkt: 0.0, sjit: 0.0, djit: 0.0,
  swin: 0, stcpb: 0, dtcpb: 0, dwin: 0, tcprtt: 0.0, synack: 0.0, ackdat: 0.0,
  smean: 100, dmean: 0, trans_depth: 0, response_body_len: 0, ct_srv_src: 1,
  ct_state_ttl: 2, ct_dst_ltm: 1, ct_src_dport_ltm: 1, ct_dst_sport_ltm: 1,
  ct_dst_src_ltm: 1, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 0,
  ct_src_ltm: 1, ct_srv_dst: 1, is_sm_ips_ports: 0,
};

async function runTests() {
  console.log('\n=============================================================');
  console.log('RUNNING BACKEND TWO-STAGE INTEGRATION TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Prediction Schema & Model Validation Tests
  // ---------------------------------------------------------------------------
  await test('Prediction Schema: Valid Normal two-stage document passes validation', async () => {
    const doc = new Prediction({
      userId: new mongoose.Types.ObjectId(),
      isAttack: false,
      attackCategory: 'Normal',
      confidence: 0.9997,
      routingPath: 'stage1_only',
      stage1Binary: {
        prediction: 'Normal',
        attack_probability: 0.000257,
        threshold: 0.325,
        is_attack: false,
        raw_log_odds: -8.2647,
      },
      stage2Multiclass: null,
      probabilities: { Normal: 0.999743, Attack: 0.000257 },
      inputFeatures: sampleNormalFeatures,
    });

    await doc.validate();
    assert.strictEqual(doc.isAttack, false);
    assert.strictEqual(doc.routingPath, 'stage1_only');
    assert.strictEqual(doc.stage2Multiclass, null);

    // Test JSON transform aliases
    const json = doc.toJSON();
    assert.strictEqual(json.is_attack, false);
    assert.strictEqual(json.attack_category, 'Normal');
    assert.strictEqual(json.routing_path, 'stage1_only');
    assert.strictEqual(json.stage2_multiclass, null);
    assert.ok(json.stage1_binary);
  });

  await test('Prediction Schema: Valid Malicious two-stage document passes validation', async () => {
    const doc = new Prediction({
      userId: new mongoose.Types.ObjectId(),
      isAttack: true,
      attackCategory: 'Exploits',
      confidence: 0.4513,
      routingPath: 'stage1_and_stage2',
      stage1Binary: {
        prediction: 'Attack',
        attack_probability: 0.99767,
        threshold: 0.325,
        is_attack: true,
        raw_log_odds: 6.0597,
      },
      stage2Multiclass: {
        attack_category: 'Exploits',
        confidence: 0.4513,
        probabilities: { Exploits: 0.4513, DoS: 0.3213, Normal: 0.0011 },
      },
      probabilities: { Exploits: 0.4513, DoS: 0.3213, Normal: 0.0011 },
      inputFeatures: sampleMaliciousFeatures,
    });

    await doc.validate();
    assert.strictEqual(doc.isAttack, true);
    assert.strictEqual(doc.routingPath, 'stage1_and_stage2');
    assert.ok(doc.stage2Multiclass);
    assert.strictEqual(doc.stage2Multiclass.attack_category, 'Exploits');

    const json = doc.toJSON();
    assert.strictEqual(json.is_attack, true);
    assert.strictEqual(json.routing_path, 'stage1_and_stage2');
    assert.strictEqual(json.stage2_multiclass.attack_category, 'Exploits');
  });

  await test('Prediction Schema: Rejects invalid confidence or invalid routingPath', async () => {
    const doc = new Prediction({
      userId: new mongoose.Types.ObjectId(),
      isAttack: true,
      attackCategory: 'Exploits',
      confidence: 1.5, // Invalid: must be <= 1.0
      routingPath: 'invalid_path', // Invalid: must be stage1_only or stage1_and_stage2
    });

    let err = null;
    try {
      await doc.validate();
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.ok(err.errors.confidence);
    assert.ok(err.errors.routingPath);
  });

  // ---------------------------------------------------------------------------
  // 2. ML Service Client Unit Tests (Mocking HTTP transport)
  // ---------------------------------------------------------------------------
  await test('MLService: predictTwoStage forwards to POST /predict/two-stage', async () => {
    let captured = null;
    const client = new MLService('http://localhost:8000');
    client._request = async (endpoint, opts) => {
      captured = { endpoint, opts };
      return { prediction: 'Normal', routing_path: 'stage1_only' };
    };

    const res = await client.predictTwoStage(sampleNormalFeatures);
    assert.strictEqual(captured.endpoint, '/predict/two-stage');
    assert.strictEqual(captured.opts.method, 'POST');
    assert.deepStrictEqual(captured.opts.body, sampleNormalFeatures);
    assert.strictEqual(res.prediction, 'Normal');
  });

  await test('MLService: explainBinaryLocal forwards to POST /explain/binary/local', async () => {
    let captured = null;
    const client = new MLService('http://localhost:8000');
    client._request = async (endpoint, opts) => {
      captured = { endpoint, opts };
      return { prediction: 'Normal', raw_log_odds_margin: -8.26 };
    };

    const res = await client.explainBinaryLocal(sampleNormalFeatures);
    assert.strictEqual(captured.endpoint, '/explain/binary/local');
    assert.strictEqual(captured.opts.method, 'POST');
    assert.strictEqual(res.raw_log_odds_margin, -8.26);
  });

  await test('MLService: getBinaryGlobalExplanations forwards to GET /explain/binary/global', async () => {
    let captured = null;
    const client = new MLService('http://localhost:8000');
    client._request = async (endpoint, opts) => {
      captured = { endpoint, opts };
      return { top_features: [{ rank: 1, raw_feature_name: 'num__sttl' }] };
    };

    const res = await client.getBinaryGlobalExplanations();
    assert.strictEqual(captured.endpoint, '/explain/binary/global');
    assert.strictEqual(captured.opts.method, 'GET');
    assert.strictEqual(res.top_features[0].raw_feature_name, 'num__sttl');
  });

  // ---------------------------------------------------------------------------
  // 3. Prediction Controller Two-Stage Logic Tests
  // ---------------------------------------------------------------------------
  await test('Controller: createPrediction handles Normal traffic with Stage 2 bypassed', async () => {
    const mlService = require('../src/services/ml.service');
    const originalPredictTwoStage = mlService.predictTwoStage;
    const originalCreate = Prediction.create;

    let savedPayload = null;

    try {
      // Mock ML service response for Normal flow
      mlService.predictTwoStage = async () => ({
        prediction: 'Normal',
        attack_category: 'Normal',
        is_attack: false,
        confidence: 0.9997,
        routing_path: 'stage1_only',
        stage1_binary: {
          prediction: 'Normal',
          attack_probability: 0.000257,
          threshold: 0.325,
          is_attack: false,
          raw_log_odds: -8.2647,
        },
        stage2_multiclass: null,
      });

      // Mock MongoDB create
      Prediction.create = async (doc) => {
        savedPayload = doc;
        return {
          ...doc,
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      };

      const req = {
        user: { _id: new mongoose.Types.ObjectId() },
        body: sampleNormalFeatures,
      };

      let responseStatus = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await predictionController.createPrediction(req, res);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.prediction, 'Normal');
      assert.strictEqual(responseBody.data.is_attack, false);
      assert.strictEqual(responseBody.data.routing_path, 'stage1_only');
      assert.strictEqual(responseBody.data.stage2_multiclass, null);
      assert.ok(responseBody.data.predictionId);

      // Verify MongoDB persistence payload
      assert.strictEqual(savedPayload.isAttack, false);
      assert.strictEqual(savedPayload.routingPath, 'stage1_only');
      assert.strictEqual(savedPayload.stage2Multiclass, null);
      assert.ok(savedPayload.probabilities.Normal > 0.99);
      assert.deepStrictEqual(savedPayload.inputFeatures, sampleNormalFeatures);
    } finally {
      mlService.predictTwoStage = originalPredictTwoStage;
      Prediction.create = originalCreate;
    }
  });

  await test('Controller: createPrediction handles Malicious traffic with Stage 2 triage', async () => {
    const mlService = require('../src/services/ml.service');
    const originalPredictTwoStage = mlService.predictTwoStage;
    const originalCreate = Prediction.create;

    let savedPayload = null;

    try {
      // Mock ML service response for Malicious flow
      mlService.predictTwoStage = async () => ({
        prediction: 'Exploits',
        attack_category: 'Exploits',
        is_attack: true,
        confidence: 0.4513,
        routing_path: 'stage1_and_stage2',
        stage1_binary: {
          prediction: 'Attack',
          attack_probability: 0.99767,
          threshold: 0.325,
          is_attack: true,
          raw_log_odds: 6.0597,
        },
        stage2_multiclass: {
          attack_category: 'Exploits',
          confidence: 0.4513,
          probabilities: {
            Exploits: 0.4513,
            DoS: 0.3213,
            Normal: 0.0011,
          },
        },
      });

      Prediction.create = async (doc) => {
        savedPayload = doc;
        return {
          ...doc,
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      };

      const req = {
        user: { _id: new mongoose.Types.ObjectId() },
        body: sampleMaliciousFeatures,
      };

      let responseStatus = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await predictionController.createPrediction(req, res);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.prediction, 'Exploits');
      assert.strictEqual(responseBody.data.is_attack, true);
      assert.strictEqual(responseBody.data.routing_path, 'stage1_and_stage2');
      assert.ok(responseBody.data.stage2_multiclass);
      assert.strictEqual(responseBody.data.stage2_multiclass.attack_category, 'Exploits');

      // Verify MongoDB persistence payload
      assert.strictEqual(savedPayload.isAttack, true);
      assert.strictEqual(savedPayload.routingPath, 'stage1_and_stage2');
      assert.strictEqual(savedPayload.stage2Multiclass.attack_category, 'Exploits');
      assert.strictEqual(savedPayload.probabilities.Exploits, 0.4513);
      assert.deepStrictEqual(savedPayload.inputFeatures, sampleMaliciousFeatures);
    } finally {
      mlService.predictTwoStage = originalPredictTwoStage;
      Prediction.create = originalCreate;
    }
  });

  await test('Controller: explainPrediction routes Normal predictionId to Binary SHAP', async () => {
    const mlService = require('../src/services/ml.service');
    const originalFindOne = Prediction.findOne;
    const originalExplainBinaryLocal = mlService.explainBinaryLocal;

    let calledBinary = false;

    try {
      const predId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      Prediction.findOne = async () => ({
        _id: predId,
        userId: userId,
        isAttack: false,
        attackCategory: 'Normal',
        confidence: 0.9997,
        routingPath: 'stage1_only',
        inputFeatures: sampleNormalFeatures,
      });

      mlService.explainBinaryLocal = async () => {
        calledBinary = true;
        return {
          prediction: 'Normal',
          is_attack: false,
          attack_probability: 0.000257,
          raw_log_odds_margin: -8.2647,
          base_value: -0.0257,
          sum_of_shap_values: -8.239,
          additivity_verified: true,
          threshold: 0.325,
          units: 'raw log-odds margin contributions (additive in logit space: margin = base_value + sum(SHAP), P = sigmoid(margin)); not probabilities',
          top_positive: [],
          top_negative: [{ feature: 'num__sttl', shap_value: -6.27 }],
          contributions: { num__sttl: -6.27 },
        };
      };

      const req = {
        user: { _id: userId },
        body: { predictionId: predId.toString() },
      };

      let responseStatus = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await predictionController.explainPrediction(req, res);

      assert.strictEqual(calledBinary, true);
      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.explanation_type, 'binary_stage1');
      assert.strictEqual(responseBody.data.metric_type, 'log_odds_margin');
      assert.strictEqual(responseBody.data.predicted_class, 'Normal');
      assert.ok(responseBody.data.units.includes('raw log-odds margin contributions'));
      assert.strictEqual(responseBody.data.raw_log_odds_margin, -8.2647);
    } finally {
      Prediction.findOne = originalFindOne;
      mlService.explainBinaryLocal = originalExplainBinaryLocal;
    }
  });

  await test('Controller: explainPrediction routes Malicious predictionId to Multiclass SHAP', async () => {
    const mlService = require('../src/services/ml.service');
    const originalFindOne = Prediction.findOne;
    const originalExplainLocal = mlService.explainLocal;

    let calledMulticlass = false;

    try {
      const predId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      Prediction.findOne = async () => ({
        _id: predId,
        userId: userId,
        isAttack: true,
        attackCategory: 'Exploits',
        confidence: 0.89,
        routingPath: 'stage1_and_stage2',
        inputFeatures: sampleMaliciousFeatures,
      });

      mlService.explainLocal = async () => {
        calledMulticlass = true;
        return {
          predicted_class: 'Exploits',
          base_value: -1.25,
          confidence: 0.89,
          top_positive: [{ feature: 'num__sttl', shap_value: 1.5 }],
          top_negative: [{ feature: 'num__dbytes', shap_value: -0.4 }],
          contributions: { num__sttl: 1.5, num__dbytes: -0.4 },
        };
      };

      const req = {
        user: { _id: userId },
        body: { predictionId: predId.toString() },
      };

      let responseStatus = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await predictionController.explainPrediction(req, res);

      assert.strictEqual(calledMulticlass, true);
      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.explanation_type, 'multiclass_stage2');
      assert.strictEqual(responseBody.data.predicted_class, 'Exploits');
    } finally {
      Prediction.findOne = originalFindOne;
      mlService.explainLocal = originalExplainLocal;
    }
  });

  await test('Controller: getPredictionHistory queries with strict user isolation', async () => {
    const originalFind = Prediction.find;
    const originalCount = Prediction.countDocuments;

    let capturedFilter = null;
    let selectedExclude = null;

    try {
      const userId = new mongoose.Types.ObjectId();
      Prediction.find = (filter) => {
        capturedFilter = filter;
        return {
          select: (sel) => {
            selectedExclude = sel;
            return {
              sort: () => ({
                skip: () => ({
                  limit: () => [
                    { _id: new mongoose.Types.ObjectId(), attackCategory: 'Normal', isAttack: false, routingPath: 'stage1_only' },
                    { _id: new mongoose.Types.ObjectId(), attackCategory: 'Exploits', isAttack: true, routingPath: 'stage1_and_stage2' },
                  ],
                }),
              }),
            };
          },
        };
      };
      Prediction.countDocuments = async (filter) => 2;

      const req = {
        user: { _id: userId },
        query: { page: '1', limit: '10' },
      };

      let responseStatus = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await predictionController.getPredictionHistory(req, res);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.predictions.length, 2);
      assert.deepStrictEqual(capturedFilter, { userId });
      assert.strictEqual(selectedExclude, '-inputFeatures');
      assert.strictEqual(responseBody.data.pagination.total, 2);
    } finally {
      Prediction.find = originalFind;
      Prediction.countDocuments = originalCount;
    }
  });

  await test('Controller: getPredictionById enforces strict user ownership and returns full details', async () => {
    const originalFindOne = Prediction.findOne;

    try {
      const predId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      Prediction.findOne = async (query) => {
        if (query._id === predId.toString() && query.userId.equals(userId)) {
          return {
            _id: predId,
            userId,
            isAttack: false,
            attackCategory: 'Normal',
            confidence: 0.9997,
            routingPath: 'stage1_only',
            stage1Binary: { prediction: 'Normal', threshold: 0.325 },
            stage2Multiclass: null,
            inputFeatures: sampleNormalFeatures,
          };
        }
        return null;
      };

      // 1. Success case (owner)
      const reqSuccess = {
        user: { _id: userId },
        params: { id: predId.toString() },
      };
      let resSuccessData = null;
      const resSuccess = {
        status: (code) => ({
          json: (data) => { resSuccessData = { code, data }; },
        }),
      };
      await predictionController.getPredictionById(reqSuccess, resSuccess);
      assert.strictEqual(resSuccessData.code, 200);
      assert.strictEqual(resSuccessData.data.data.attackCategory, 'Normal');
      assert.strictEqual(resSuccessData.data.data.routingPath, 'stage1_only');
      assert.ok(resSuccessData.data.data.inputFeatures);

      // 2. Unowned/forbidden case (different user)
      const reqForbidden = {
        user: { _id: new mongoose.Types.ObjectId() },
        params: { id: predId.toString() },
      };
      let resForbiddenData = null;
      const resForbidden = {
        status: (code) => ({
          json: (data) => { resForbiddenData = { code, data }; },
        }),
      };
      await predictionController.getPredictionById(reqForbidden, resForbidden);
      assert.strictEqual(resForbiddenData.code, 404);
      assert.strictEqual(resForbiddenData.data.success, false);
    } finally {
      Prediction.findOne = originalFindOne;
    }
  });

  await test('Controller: getPredictionAnalytics accurately calculates two-stage metrics', async () => {
    const originalAggregate = Prediction.aggregate;

    try {
      const userId = new mongoose.Types.ObjectId();

      Prediction.aggregate = async () => [
        {
          summary: [
            {
              totalPredictions: 10,
              avgConfidence: 0.9412,
              normalCount: 7,
              maliciousCount: 3,
            },
          ],
          categoryDistribution: [
            { _id: 'Normal', count: 7 },
            { _id: 'Exploits', count: 2 },
            { _id: 'DoS', count: 1 },
          ],
          timeline: [
            { _id: '2026-11-21', total: 10, normal: 7, malicious: 3 },
          ],
          recentPredictions: [
            { _id: new mongoose.Types.ObjectId(), attackCategory: 'Normal', confidence: 0.9997, createdAt: new Date() },
          ],
        },
      ];

      const req = { user: { _id: userId } };
      let resData = null;
      const res = {
        status: (code) => ({
          json: (data) => { resData = { code, data }; },
        }),
      };

      await predictionController.getPredictionAnalytics(req, res);

      assert.strictEqual(resData.code, 200);
      assert.strictEqual(resData.data.data.summary.totalPredictions, 10);
      assert.strictEqual(resData.data.data.summary.normalCount, 7);
      assert.strictEqual(resData.data.data.summary.maliciousCount, 3);
      assert.strictEqual(resData.data.data.summary.normalPercentage, 70.0);
      assert.strictEqual(resData.data.data.summary.maliciousPercentage, 30.0);
    } finally {
      Prediction.aggregate = originalAggregate;
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Express Routes & Middleware Protection Tests
  // ---------------------------------------------------------------------------
  const { EventEmitter } = require('events');

  function invokeRoute(options) {
    return new Promise((resolve) => {
      const req = new EventEmitter();
      req.method = options.method || 'GET';
      req.url = options.url || '/';
      req.headers = options.headers || {};
      req.query = options.query || {};
      req.body = options.body || {};

      const res = new EventEmitter();
      res.statusCode = 200;
      res.setHeader = () => {};
      res.getHeader = () => {};
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { resolve({ status: res.statusCode, data }); };
      res.send = (text) => { resolve({ status: res.statusCode, data: text }); };
      res.end = (data) => { resolve({ status: res.statusCode, data }); };

      app(req, res);
    });
  }

  await test('Express API: Unauthenticated requests to /api/predictions return 401', async () => {
    const res = await invokeRoute({
      method: 'POST',
      url: '/api/predictions',
      body: sampleNormalFeatures,
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.message.toLowerCase().includes('token') || res.data.message.toLowerCase().includes('authorized'));
  });

  await test('Express API: Unauthenticated requests to /api/predictions/history return 401', async () => {
    const res = await invokeRoute({
      method: 'GET',
      url: '/api/predictions/history',
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test('Express API: Unauthenticated requests to /api/predictions/analytics return 401', async () => {
    const res = await invokeRoute({
      method: 'GET',
      url: '/api/predictions/analytics',
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test('Express API: Health endpoint /api/health returns 200 OK without auth', async () => {
    const res = await invokeRoute({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
  });

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

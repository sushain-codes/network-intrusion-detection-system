const fs = require('fs');

const BACKEND_URL = 'http://127.0.0.1:5000/api';
const FASTAPI_URL = 'http://127.0.0.1:8000';
const FRONTEND_URL = 'http://127.0.0.1:3000';

const normalTrafficPayload = {
  dur: 0.121478, proto: 'tcp', service: 'http', state: 'FIN', spkts: 6, dpkts: 8,
  sbytes: 258, dbytes: 4022, rate: 107.0152, sttl: 31, dttl: 29, sload: 14751.64,
  dload: 234567.8, sloss: 0, dloss: 0, sinpkt: 24.29, dinpkt: 17.35, sjit: 13.9, djit: 14.2,
  swin: 255, stcpb: 110283, dtcpb: 110284, dwin: 255, tcprtt: 0.0008, synack: 0.0004,
  ackdat: 0.0004, smean: 43, dmean: 503, trans_depth: 1, response_body_len: 268,
  ct_srv_src: 1, ct_state_ttl: 0, ct_dst_ltm: 1, ct_src_dport_ltm: 1, ct_dst_sport_ltm: 1,
  ct_dst_src_ltm: 1, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 1,
  ct_src_ltm: 1, ct_srv_dst: 1, is_sm_ips_ports: 0
};

const attackTrafficPayload = {
  dur: 0.000002, proto: 'rdp', service: '-', state: 'INT', spkts: 2, dpkts: 0,
  sbytes: 200, dbytes: 0, rate: 500000.0013, sttl: 254, dttl: 0, sload: 400000000.0,
  dload: 0.0, sloss: 0, dloss: 0, sinpkt: 0.002, dinpkt: 0.0, sjit: 0.0, djit: 0.0,
  swin: 0, stcpb: 0, dtcpb: 0, dwin: 0, tcprtt: 0.0, synack: 0.0, ackdat: 0.0,
  smean: 100, dmean: 0, trans_depth: 0, response_body_len: 0, ct_srv_src: 6,
  ct_state_ttl: 2, ct_dst_ltm: 3, ct_src_dport_ltm: 3, ct_dst_sport_ltm: 3,
  ct_dst_src_ltm: 6, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 0,
  ct_src_ltm: 3, ct_srv_dst: 6, is_sm_ips_ports: 0
};

const results = {
  passed: [],
  failed: [],
};

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    results.passed.push(testName);
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    results.failed.push({ testName, details });
  }
}

async function api(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  let data = null;
  const text = await resp.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: resp.status, data };
}

async function runE2E() {
  console.log('================================================================');
  console.log('       XAI-NIDS FULL END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  // STEP 1: Service Health Checks
  console.log('--- Step 1: Verifying All Three Running Services ---');
  try {
    const fastApiHealth = await api(`${FASTAPI_URL}/health`);
    assert(fastApiHealth.status === 200 && fastApiHealth.data.status === 'healthy',
      'FastAPI ML Service Health Check (Port 8000)');
    assert(fastApiHealth.data.artifacts?.binary_model?.loaded === true,
      'FastAPI Binary XGBoost Model Loaded');
    assert(fastApiHealth.data.artifacts?.model?.loaded === true,
      'FastAPI Multiclass XGBoost Model Loaded');
  } catch (err) {
    assert(false, 'FastAPI ML Service Health Check', err.message);
  }

  try {
    const backendHealth = await api(`${BACKEND_URL}/health`);
    assert(backendHealth.status === 200 && backendHealth.data.status === 'ok',
      'Express Backend Health Check (Port 5000)');
  } catch (err) {
    assert(false, 'Express Backend Health Check', err.message);
  }

  try {
    const frontendResp = await fetch(FRONTEND_URL);
    const html = await frontendResp.text();
    assert(frontendResp.status === 200 && html.includes('XAI-NIDS'),
      'React Frontend Vite Server Serving index.html (Port 3000)');
  } catch (err) {
    assert(false, 'React Frontend Vite Server Serving index.html', err.message);
  }

  // STEP 2: User Registration & Authentication
  console.log('\n--- Step 2: User Journey - Registration & Authentication ---');
  const timestamp = Date.now();
  const testUser = {
    name: `E2E Auditor ${timestamp}`,
    email: `auditor_${timestamp}@xai-nids.local`,
    password: 'SecurePassword123!',
  };

  let token = null;

  try {
    const regRes = await api(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(testUser),
    });
    assert(regRes.status === 201 && regRes.data.success && regRes.data.data?.token,
      'User Registration via POST /api/auth/register');
    token = regRes.data.data.token;
  } catch (err) {
    assert(false, 'User Registration', err.message);
  }

  try {
    const loginRes = await api(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    assert(loginRes.status === 200 && loginRes.data.success && loginRes.data.data?.token,
      'User Login via POST /api/auth/login');
    token = loginRes.data.data.token; // refresh token
  } catch (err) {
    assert(false, 'User Login', err.message);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // STEP 3: Submit Normal Connection & Verify Pipeline Routing
  console.log('\n--- Step 3: Normal Connection Analysis (Stage 1 Normal & Stage 2 Bypassed) ---');
  let normalPredictionId = null;
  try {
    const normRes = await api(`${BACKEND_URL}/predictions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(normalTrafficPayload),
    });
    assert((normRes.status === 200 || normRes.status === 201) && normRes.data.success, 'Submit Normal Connection via POST /api/predictions');
    const d = normRes.data.data;
    normalPredictionId = d.predictionId;

    assert(d.is_attack === false || d.isAttack === false, 'Outcome is Benign Normal (is_attack = false)');
    assert(d.attack_category === 'Normal', 'Attack Category is Normal');
    assert(d.routing_path === 'stage1_only', 'Routing Path is stage1_only (Stage 2 Bypassed)');
    assert(d.stage1_binary && d.stage1_binary.prediction === 'Normal', 'Stage 1 Binary Decision is Normal');
    assert(d.stage1_binary.attack_probability < 0.325, `Stage 1 Attack Probability (${d.stage1_binary.attack_probability}) < 0.325`);
    assert(d.stage2_multiclass === null, 'Stage 2 Multiclass Result is null (Bypassed)');
  } catch (err) {
    assert(false, 'Submit Normal Connection', err.message);
  }

  // STEP 4: Submit Malicious Connection & Verify Two-Stage Pipeline
  console.log('\n--- Step 4: Malicious Connection Analysis (Stage 1 Attack & Stage 2 Triage) ---');
  let maliciousPredictionId = null;
  try {
    const attRes = await api(`${BACKEND_URL}/predictions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(attackTrafficPayload),
    });
    assert((attRes.status === 200 || attRes.status === 201) && attRes.data.success, 'Submit Threat Connection via POST /api/predictions');
    const d = attRes.data.data;
    maliciousPredictionId = d.predictionId;

    assert(d.is_attack === true || d.isAttack === true, 'Outcome is Threat Detected (is_attack = true)');
    assert(d.attack_category !== 'Normal', `Attack Category Identified: ${d.attack_category}`);
    assert(d.routing_path === 'stage1_and_stage2', 'Routing Path is stage1_and_stage2');
    assert(d.stage1_binary && d.stage1_binary.prediction === 'Attack', 'Stage 1 Binary Decision is Attack');
    assert(d.stage1_binary.attack_probability >= 0.325, `Stage 1 Attack Probability (${d.stage1_binary.attack_probability}) >= 0.325`);
    assert(d.stage2_multiclass !== null, 'Stage 2 Multiclass Result is present');
    assert(d.stage2_multiclass.probabilities && Object.keys(d.stage2_multiclass.probabilities).length === 10,
      'Stage 2 Multiclass Posterior Probabilities for all 10 Classes');
  } catch (err) {
    assert(false, 'Submit Threat Connection', err.message);
  }

  // STEP 5: Verify MongoDB Persistence & Details Retrieval
  console.log('\n--- Step 5: Verification of MongoDB Persistence & Record Details ---');
  try {
    const normDetRes = await api(`${BACKEND_URL}/predictions/${normalPredictionId}`, { headers: authHeaders });
    assert(normDetRes.status === 200 && normDetRes.data.success, 'Retrieve Normal Record Details via GET /api/predictions/:id');
    const nd = normDetRes.data.data;
    assert(nd.isAttack === false, 'Stored isAttack is false');
    assert(nd.routingPath === 'stage1_only', 'Stored routingPath is stage1_only');
    assert(nd.stage1Binary && nd.stage1Binary.is_attack === false, 'Stored stage1Binary matches');
    assert(nd.stage2Multiclass === null, 'Stored stage2Multiclass is null');
    assert(nd.inputFeatures && Object.keys(nd.inputFeatures).length === 42, 'Stored all 42 raw input features');

    const attDetRes = await api(`${BACKEND_URL}/predictions/${maliciousPredictionId}`, { headers: authHeaders });
    assert(attDetRes.status === 200 && attDetRes.data.success, 'Retrieve Malicious Record Details via GET /api/predictions/:id');
    const ad = attDetRes.data.data;
    assert(ad.isAttack === true, 'Stored isAttack is true');
    assert(ad.routingPath === 'stage1_and_stage2', 'Stored routingPath is stage1_and_stage2');
    assert(ad.stage2Multiclass && ad.stage2Multiclass.attack_category === ad.attackCategory, 'Stored stage2Multiclass attack category matches');
  } catch (err) {
    assert(false, 'Verify MongoDB Persistence', err.message);
  }

  // STEP 6: Verify Dashboard Analytics & Recent Activity
  console.log('\n--- Step 6: Dashboard Analytics & Recent Activity Verification ---');
  try {
    const dashRes = await api(`${BACKEND_URL}/predictions/analytics`, { headers: authHeaders });
    assert(dashRes.status === 200 && dashRes.data.success, 'GET /api/predictions/analytics');
    const sm = dashRes.data.data.summary;
    assert(sm.totalPredictions >= 2, `Total predictions recorded: ${sm.totalPredictions}`);
    assert(sm.normalCount >= 1 && sm.maliciousCount >= 1, `Normal count: ${sm.normalCount}, Malicious count: ${sm.maliciousCount}`);
    const ra = dashRes.data.data.recentActivity;
    assert(ra && ra.length >= 2, 'Recent activity log includes submitted predictions');
  } catch (err) {
    assert(false, 'Dashboard Analytics', err.message);
  }

  // STEP 7: Verify Prediction History & Pagination
  console.log('\n--- Step 7: Prediction History & Pagination Verification ---');
  try {
    const histRes = await api(`${BACKEND_URL}/predictions/history?page=1&limit=10`, { headers: authHeaders });
    assert(histRes.status === 200 && histRes.data.success, 'GET /api/predictions/history?page=1&limit=10');
    assert(Array.isArray(histRes.data.data.predictions) && histRes.data.data.predictions.length >= 2,
      'History contains array of user predictions');
    assert(histRes.data.data.pagination && histRes.data.data.pagination.page === 1,
      'Server-side pagination metadata returned correctly');
  } catch (err) {
    assert(false, 'Prediction History', err.message);
  }

  // STEP 8: Local SHAP Explainability (Binary vs Multiclass Auto-Routing)
  console.log('\n--- Step 8: Local SHAP Explainability (Binary for Normal, Multiclass for Malicious) ---');
  try {
    // 8a: Normal prediction -> Binary Stage 1 SHAP
    const normShapRes = await api(`${BACKEND_URL}/predictions/explain`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ predictionId: normalPredictionId }),
    });
    assert(normShapRes.status === 200 && normShapRes.data.success, 'Explain Normal Prediction via POST /api/predictions/explain');
    const nsd = normShapRes.data.data;
    assert(nsd.explanation_type === 'binary_stage1', 'Explanation type is binary_stage1');
    assert(nsd.units && nsd.units.includes('log-odds'), 'Units explicitly indicate log-odds margin contributions');
    assert(typeof nsd.base_value === 'number', `Base value returned: ${nsd.base_value}`);
    assert(typeof nsd.raw_log_odds_margin === 'number', `Raw log-odds margin returned: ${nsd.raw_log_odds_margin}`);
    assert(nsd.additivity_verified === true, `SHAP Additivity Verified (error: ${nsd.additivity_error})`);
    assert(Array.isArray(nsd.top_positive) && Array.isArray(nsd.top_negative), 'Top positive and top negative contributors returned');

    // 8b: Malicious prediction -> Multiclass Stage 2 SHAP
    const attShapRes = await api(`${BACKEND_URL}/predictions/explain`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ predictionId: maliciousPredictionId }),
    });
    assert(attShapRes.status === 200 && attShapRes.data.success, 'Explain Threat Prediction via POST /api/predictions/explain');
    const asd = attShapRes.data.data;
    assert(asd.explanation_type === 'multiclass_stage2', 'Explanation type is multiclass_stage2');
    assert(asd.predicted_class && asd.predicted_class !== 'Normal', `Predicted class explained: ${asd.predicted_class}`);
    assert(Array.isArray(asd.top_positive) && Array.isArray(asd.top_negative), 'Multiclass top positive and top negative contributors returned');
  } catch (err) {
    assert(false, 'Local SHAP Explanations', err.message);
  }

  // STEP 9: Global Explanations for Both Models
  console.log('\n--- Step 9: Global SHAP Explanations for Both Models ---');
  try {
    // 9a: Binary Global SHAP
    const binGlobRes = await api(`${BACKEND_URL}/predictions/explain/binary/global`, { headers: authHeaders });
    assert(binGlobRes.status === 200 && binGlobRes.data.success, 'GET /api/predictions/explain/binary/global');
    const bgd = binGlobRes.data.data;
    assert(Array.isArray(bgd.top_features) && bgd.top_features.length === 20, 'Binary global top 20 features returned');
    assert(bgd.top_features[0].clean_name === 'sttl', `Rank 1 Binary feature is ${bgd.top_features[0].clean_name}`);
    assert(Math.abs(bgd.base_value_log_odds - (-0.02572056)) < 0.001,
      `Binary Global Base Value is approximately -0.02572 (Actual: ${bgd.base_value_log_odds})`);

    // 9b: Multiclass Global SHAP
    const mulGlobRes = await api(`${BACKEND_URL}/predictions/global-explanations`, { headers: authHeaders });
    assert(mulGlobRes.status === 200 && mulGlobRes.data.success, 'GET /api/predictions/global-explanations');
    const mgd = mulGlobRes.data.data;
    assert(Array.isArray(mgd.top_features) && mgd.top_features.length === 20, 'Multiclass global top 20 features returned');
  } catch (err) {
    assert(false, 'Global SHAP Explanations', err.message);
  }

  // STEP 10: Route Protection & Unauthenticated Checks
  console.log('\n--- Step 10: Protected Routes & Security Checks ---');
  try {
    const unauthRes = await api(`${BACKEND_URL}/predictions/history`);
    assert(unauthRes.status === 401, 'Protected route returns 401 Unauthorized when missing token');
  } catch (err) {
    assert(false, 'Protected Route without token', err.message);
  }

  try {
    const invRes = await api(`${BACKEND_URL}/predictions/history`, {
      headers: { Authorization: 'Bearer invalid_token_xyz' },
    });
    assert(invRes.status === 401, 'Protected route returns 401 Unauthorized with invalid token');
  } catch (err) {
    assert(false, 'Protected Route with invalid token', err.message);
  }

  // SUMMARY
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
  console.log('================================================================');
  if (results.failed.length > 0) {
    console.error('Failed Tests:', JSON.stringify(results.failed, null, 2));
    process.exit(1);
  } else {
    console.log('All end-to-end integration tests passed successfully!');
    process.exit(0);
  }
}

runE2E().catch((err) => {
  console.error('Fatal E2E test runner exception:', err);
  process.exit(1);
});

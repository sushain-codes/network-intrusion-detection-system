/**
 * ML Service Client
 * Handles communication between Express backend and FastAPI ML microservice.
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 10000;

class MLService {
  constructor(baseURL = null) {
    this._customBaseURL = baseURL;
  }

  /**
   * Get the current base URL for the ML service, stripping trailing slashes.
   */
  get baseURL() {
    const rawUrl = this._customBaseURL || process.env.ML_SERVICE_URL || 'http://localhost:8000';
    return rawUrl.replace(/\/+$/, '');
  }

  /**
   * Internal helper to execute HTTP requests to FastAPI with timeouts and normalized error handling.
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const signal = AbortSignal.timeout(timeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    const fetchConfig = {
      method: options.method || 'GET',
      headers,
      signal,
    };

    if (options.body) {
      fetchConfig.body = typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (error) {
      // Handle AbortError / TimeoutError
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        const timeoutErr = new Error(`ML service request timed out after ${timeoutMs}ms.`);
        timeoutErr.status = 504;
        timeoutErr.code = 'ML_SERVICE_TIMEOUT';
        throw timeoutErr;
      }

      // Handle connection errors (ECONNREFUSED, ENOTFOUND, etc.)
      const connectionErr = new Error(
        'ML prediction service is currently unavailable. Please verify that the ML service is running.'
      );
      connectionErr.status = 503;
      connectionErr.code = 'ML_SERVICE_UNAVAILABLE';
      connectionErr.originalError = error.message;
      throw connectionErr;
    }

    // Parse response body
    let data;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    // Handle non-2xx responses
    if (!response.ok) {
      const err = new Error(
        data.detail
          ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
          : `ML service error: ${response.statusText}`
      );
      err.details = data.detail || data;

      if (response.status === 422) {
        err.status = 400; // Client-side schema validation error
        err.code = 'ML_VALIDATION_ERROR';
      } else if (response.status === 503) {
        err.status = 503; // Service unavailable (e.g. artifacts not loaded)
        err.code = 'ML_SERVICE_UNAVAILABLE';
      } else if (response.status >= 500) {
        err.status = 502; // Bad Gateway from upstream ML service
        err.code = 'ML_UPSTREAM_ERROR';
      } else {
        err.status = response.status;
        err.code = 'ML_REQUEST_ERROR';
      }

      throw err;
    }

    return data;
  }

  /**
   * Forward raw 42 features to FastAPI POST /predict/two-stage
   * @param {Object} features - 42 network traffic features
   * @returns {Promise<Object>} Two-stage hierarchical prediction result
   */
  async predictTwoStage(features) {
    return this._request('/predict/two-stage', {
      method: 'POST',
      body: features,
    });
  }

  /**
   * Forward raw 42 features to FastAPI POST /predict/binary
   * @param {Object} features - 42 network traffic features
   * @returns {Promise<Object>} Binary prediction result
   */
  async predictBinary(features) {
    return this._request('/predict/binary', {
      method: 'POST',
      body: features,
    });
  }

  /**
   * Prediction integration point (defaults to two-stage architecture)
   * @param {Object} features - 42 network traffic features
   * @returns {Promise<Object>} Prediction result
   */
  async predict(features) {
    return this.predictTwoStage(features);
  }

  /**
   * Forward raw 42 features to FastAPI POST /explain/local (Multiclass Stage 2 SHAP)
   * @param {Object} features - 42 network traffic features
   * @returns {Promise<Object>} Local SHAP explanations for predicted class
   */
  async explainLocal(features) {
    return this._request('/explain/local', {
      method: 'POST',
      body: features,
    });
  }

  /**
   * Forward raw 42 features to FastAPI POST /explain/binary/local (Binary Stage 1 SHAP)
   * @param {Object} features - 42 network traffic features
   * @returns {Promise<Object>} Local SHAP explanations in log-odds margin space
   */
  async explainBinaryLocal(features) {
    return this._request('/explain/binary/local', {
      method: 'POST',
      body: features,
    });
  }

  /**
   * Fetch global SHAP explanations from FastAPI GET /explain/global (Multiclass)
   * @returns {Promise<Object>} Top 20 global feature importances
   */
  async getGlobalExplanations() {
    return this._request('/explain/global', {
      method: 'GET',
    });
  }

  /**
   * Fetch binary global SHAP explanations from FastAPI GET /explain/binary/global
   * @returns {Promise<Object>} Top 20 global feature importances for binary model
   */
  async getBinaryGlobalExplanations() {
    return this._request('/explain/binary/global', {
      method: 'GET',
    });
  }

  /**
   * Check ML service health status via GET /health
   * @returns {Promise<Object>} Health and readiness payload
   */
  async checkHealth() {
    return this._request('/health', {
      method: 'GET',
      timeoutMs: 3000,
    });
  }
}

// Export singleton instance and class
const mlService = new MLService();
module.exports = mlService;
module.exports.MLService = MLService;


import api from './api';

/**
 * Prediction API Service
 * Handles prediction requests, history retrieval, and SHAP explainability from the Express backend
 */
export const predictionService = {
  /**
   * Submit 42 raw network traffic features to generate a prediction and save to history
   * @param {Object} features - Object containing the 42 raw network features
   * @returns {Promise<{ success: boolean, data: { attack_category: string, confidence: number, probabilities: object, prediction: string, predictionId: string, createdAt: string } }>}
   */
  predict: async (features) => {
    const response = await api.post('/predictions', features);
    return response.data;
  },

  /**
   * Get paginated prediction history for the authenticated user
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @returns {Promise<{ success: boolean, data: { predictions: Array, pagination: Object } }>}
   */
  getHistory: async (page = 1, limit = 10) => {
    const response = await api.get(`/predictions/history?page=${page}&limit=${limit}`);
    return response.data;
  },

  /**
   * Get full prediction details by ID
   * @param {string} id - Prediction MongoDB ObjectId
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  getPredictionById: async (id) => {
    const response = await api.get(`/predictions/${id}`);
    return response.data;
  },

  /**
   * Fetch top 20 global SHAP feature importance rankings (Multiclass 10-Class Model)
   * @returns {Promise<{ success: boolean, data: { top_features: Array, importance_scores: Object, total_features: number } }>}
   */
  getGlobalExplanations: async () => {
    const response = await api.get('/predictions/global-explanations');
    return response.data;
  },

  /**
   * Fetch top 20 global SHAP feature importance rankings (Binary Model)
   * @returns {Promise<{ success: boolean, data: { top_features: Array, importance_scores: Object, total_features: number } }>}
   */
  getBinaryGlobalExplanations: async () => {
    const response = await api.get('/predictions/explain/binary/global');
    return response.data;
  },

  /**
   * Generate local record-level SHAP explanation for 42 raw features
   * @param {Object} features - Object containing the 42 raw features
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  explainLocal: async (features) => {
    const response = await api.post('/predictions/explain', features);
    return response.data;
  },
};

export default predictionService;

import api from './api';

/**
 * Explainability API Service
 * Interacts with SHAP Explainable AI endpoints on the Express backend
 */
export const explainService = {
  /**
   * Fetch top 20 global SHAP feature importance rankings for 10-class model
   * @returns {Promise<{ success: boolean, data: { top_features: Array, importance_scores: Object, total_features: number } }>}
   */
  getGlobalExplanations: async () => {
    const response = await api.get('/predictions/global-explanations');
    return response.data;
  },

  /**
   * Fetch top 20 global SHAP feature importance rankings for binary model (Stage 1)
   * @returns {Promise<{ success: boolean, data: { top_features: Array, importance_scores: Object, total_features: number, base_value_log_odds: number, units: string } }>}
   */
  getBinaryGlobalExplanations: async () => {
    const response = await api.get('/predictions/explain/binary/global');
    return response.data;
  },

  /**
   * Generate local record-level SHAP explanation
   * Auto-selects Stage 1 Binary SHAP or Stage 2 Multiclass SHAP based on prediction or payload
   * @param {Object} payload - Features object or { predictionId } or { features, explanationType }
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  explainLocal: async (payload) => {
    const response = await api.post('/predictions/explain', payload);
    return response.data;
  },

  /**
   * Explicitly generate Binary SHAP explanation for Stage 1
   * @param {Object} features - Object containing the 42 raw features
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  explainBinaryLocal: async (features) => {
    const response = await api.post('/predictions/explain/binary', features);
    return response.data;
  },

  /**
   * Explicitly generate Multiclass SHAP explanation for Stage 2
   * @param {Object} features - Object containing the 42 raw features
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  explainMulticlassLocal: async (features) => {
    const response = await api.post('/predictions/explain/multiclass', features);
    return response.data;
  },
};

export default explainService;

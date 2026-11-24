import api from './api';

/**
 * Analytics API Service
 * Interacts with /api/predictions/analytics endpoint
 */
export const analyticsService = {
  /**
   * Fetch aggregated prediction metrics, distribution, and recent activity for the authenticated user
   * @returns {Promise<{ success: boolean, data: { summary: object, trafficBreakdown: object, categoryDistribution: array, timeline: array, recentActivity: array } }>}
   */
  getAnalytics: async () => {
    const response = await api.get('/predictions/analytics');
    return response.data;
  },
};

export default analyticsService;

import api from './api';

/**
 * Authentication service communicating with Express backend auth routes:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET  /api/auth/me
 * - POST /api/auth/logout
 */
export const authService = {
  /**
   * Register a new user
   * @param {string} name - Full user name
   * @param {string} email - Work email address
   * @param {string} password - Minimum 6 characters
   * @returns {Promise<AxiosResponse>}
   */
  register: (name, email, password) => {
    return api.post('/auth/register', { name, email, password });
  },

  /**
   * Authenticate user with credentials
   * @param {string} email - User email address
   * @param {string} password - User password
   * @returns {Promise<AxiosResponse>}
   */
  login: (email, password) => {
    return api.post('/auth/login', { email, password });
  },

  /**
   * Fetch current authenticated user's profile using stored JWT
   * @returns {Promise<AxiosResponse>}
   */
  getCurrentUser: () => {
    return api.get('/auth/me');
  },

  /**
   * Invalidate current session and blacklist JWT
   * @returns {Promise<AxiosResponse>}
   */
  logout: () => {
    return api.post('/auth/logout');
  },
};

export default authService;

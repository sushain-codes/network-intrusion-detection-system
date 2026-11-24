const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * Authentication middleware to verify JWT, ensure it is not blacklisted, and attach user to request
 */
const protect = async (req, res, next) => {
  let token;

  // Check Authorization header for Bearer token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Handle missing token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured in environment variables.');
      return res.status(500).json({
        success: false,
        message: 'Internal authentication configuration error.',
      });
    }

    // 1. Verify token signature and expiration
    const decoded = jwt.verify(token, jwtSecret);

    // 2. Check if token's jti has been blacklisted (logged out)
    if (decoded.jti) {
      const isBlacklisted = await TokenBlacklist.exists({ jti: decoded.jti });
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please log in again.',
        });
      }
    }

    // 3. Fetch user and ensure account still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // 4. Attach user and session metadata to request
    req.user = user;
    req.tokenJti = decoded.jti;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    console.error('Authentication middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

module.exports = { protect };

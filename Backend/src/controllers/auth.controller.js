const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * Generate signed JSON Web Token for authenticated user with a unique jti
 * @param {Object} user - User mongoose document or object with _id and email
 * @returns {string} Signed JWT
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const jti = crypto.randomUUID();

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      jti, // Unique JWT ID for session tracking and blacklisting
    },
    secret,
    { expiresIn }
  );
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters.',
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check for existing user with identical email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // 3. Create user (password hashing is handled by User pre-save hook)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    // 4. Generate JWT with unique jti
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    // Handle duplicate key error if race condition occurred
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during user registration.',
    });
  }
};

/**
 * @desc    Authenticate user & return JWT token with unique jti
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Find user by email and explicitly select password
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Compare password with hashed password in database
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Generate JWT with fresh unique jti
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

/**
 * @desc    Get currently authenticated user's profile
 * @route   GET /api/auth/me
 * @access  Private (Protected by auth middleware)
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error('getMe error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving user profile.',
    });
  }
};

/**
 * @desc    Log out user by blacklisting current JWT token
 * @route   POST /api/auth/logout
 * @access  Public / Protected (Idempotent, handles expired/invalid tokens safely)
 */
const logout = async (req, res) => {
  try {
    let token;

    // 1. Extract token from Authorization header or request body
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.body && req.body.token) {
      token = req.body.token;
    }

    // 2. Idempotent check: if no token provided, acknowledge logout cleanly
    if (!token) {
      return res.status(200).json({
        success: true,
        message: 'Logout successful.',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    let decoded;

    // 3. Verify or decode token safely to extract jti and expiration
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      // Decode payload if signature failed or already expired
      decoded = jwt.decode(token);
    }

    // 4. If token contains a valid jti, add to blacklist idempotently
    if (decoded && decoded.jti) {
      const expiresAt = decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      await TokenBlacklist.updateOne(
        { jti: decoded.jti },
        {
          $setOnInsert: {
            jti: decoded.jti,
            userId: decoded.id || undefined,
            expiresAt,
          },
        },
        { upsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Logout successful. Token has been invalidated.',
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout.',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  generateToken,
};

const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: [true, 'Token identifier (jti) is required'],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Token expiration date is required'],
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index: automatically remove documents when expiresAt timestamp is reached
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = TokenBlacklist;


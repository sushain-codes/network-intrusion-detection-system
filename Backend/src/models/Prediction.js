const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    isAttack: {
      type: Boolean,
      required: [true, 'Attack flag (isAttack) is required'],
      index: true,
      alias: 'is_attack',
    },
    attackCategory: {
      type: String,
      required: [true, 'Predicted attack category is required'],
      trim: true,
      alias: 'attack_category',
    },
    confidence: {
      type: Number,
      required: [true, 'Confidence score is required'],
      min: [0, 'Confidence cannot be less than 0'],
      max: [1, 'Confidence cannot exceed 1'],
    },
    routingPath: {
      type: String,
      enum: ['stage1_only', 'stage1_and_stage2'],
      default: 'stage1_only',
      alias: 'routing_path',
    },
    stage1Binary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      alias: 'stage1_binary',
    },
    stage2Multiclass: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      alias: 'stage2_multiclass',
    },
    probabilities: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return typeof v === 'object' && !Array.isArray(v);
        },
        message: 'Probabilities must be an object mapping classes to confidence scores',
      },
    },
    inputFeatures: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true, // creates createdAt and updatedAt automatically
  }
);

// Compound index for high-performance newest-first user prediction history queries
predictionSchema.index({ userId: 1, createdAt: -1 });

// Ensure virtuals and alias consistency when converting documents to JSON or objects
predictionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    if (ret.attackCategory && !ret.attack_category) {
      ret.attack_category = ret.attackCategory;
    }
    if (ret.isAttack !== undefined && ret.is_attack === undefined) {
      ret.is_attack = ret.isAttack;
    }
    if (ret.routingPath && !ret.routing_path) {
      ret.routing_path = ret.routingPath;
    }
    if (ret.stage1Binary !== undefined && ret.stage1_binary === undefined) {
      ret.stage1_binary = ret.stage1Binary;
    }
    if (ret.stage2Multiclass !== undefined && ret.stage2_multiclass === undefined) {
      ret.stage2_multiclass = ret.stage2Multiclass;
    }
    delete ret.__v;
    return ret;
  },
});

predictionSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    if (ret.attackCategory && !ret.attack_category) {
      ret.attack_category = ret.attackCategory;
    }
    if (ret.isAttack !== undefined && ret.is_attack === undefined) {
      ret.is_attack = ret.isAttack;
    }
    if (ret.routingPath && !ret.routing_path) {
      ret.routing_path = ret.routingPath;
    }
    if (ret.stage1Binary !== undefined && ret.stage1_binary === undefined) {
      ret.stage1_binary = ret.stage1Binary;
    }
    if (ret.stage2Multiclass !== undefined && ret.stage2_multiclass === undefined) {
      ret.stage2_multiclass = ret.stage2Multiclass;
    }
    delete ret.__v;
    return ret;
  },
});

const Prediction = mongoose.model('Prediction', predictionSchema);

module.exports = Prediction;


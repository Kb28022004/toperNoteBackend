const mongoose = require('mongoose');

const topperProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // 🧍 IDENTITY
    firstName: {
      type: String,
      trim: true,
      minlength: 2,
      required: true,
    },

    lastName: {
      type: String,
      trim: true,
      minlength: 2,
      required: true,
    },

    profilePhoto: {
      type: String,
    },

    shortBio: {
      type: String,
      maxlength: 300,
    },

    // 🎓 ACADEMICS
    expertiseClass: {
      type: String,
      enum: ['10', '12'],
      required: true,
      index: true,
    },

    stream: {
      type: String,
      enum: ['SCIENCE', 'COMMERCE', 'ARTS'],
      validate: {
        validator: function (value) {
          if (this.expertiseClass === '12') return Boolean(value);
          return value === undefined;
        },
        message: 'Stream required only for Class 12',
      },
    },

    board: {
      type: String,
      enum: ['CBSE', 'ICSE', 'STATE'],
      required: true,
    },

    achievements: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 1,
        message: 'At least one achievement is required',
      },
    },

    /**
     * ⭐ PUBLIC HIGHLIGHTS
     * Shown below name (rank, % etc.)
     * Example: "IIT JEE Rank 45", "CBSE 98.6%"
     */
    highlights: {
      type: [String],
      default: [],
    },

    // 📄 VERIFICATION
    marksheetUrl: {
      type: String,
    },

    yearOfPassing: {
      type: Number,
      min: 2000,
      max: new Date().getFullYear(),
    },

    subjectMarks: [
      {
        subject: {
          type: String,
          required: true,
          trim: true,
        },
        marks: {
          type: Number,
          min: 0,
          max: 100,
          required: true,
        },
      },
    ],

    /**
     * DRAFT → PENDING → APPROVED / REJECTED
     */
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'DRAFT',
      index: true,
    },

    adminRemark: {
      type: String,
      trim: true,
    },

    // ⭐ PUBLIC METRICS (CACHED COUNTERS)
    stats: {
      followersCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalNotes: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalSold: {
        type: Number,
        default: 0,
        min: 0,
      },

      rating: {
        average: {
          type: Number,
          default: 0,
          min: 0,
          max: 5,
        },
        count: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//
// 🔥 VIRTUALS
//

// Full name for UI
topperProfileSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Verified badge (derived from status)
topperProfileSchema.virtual('isVerified').get(function () {
  return this.status === 'APPROVED';
});

//
// 🚀 INDEXES FOR PUBLIC PROFILE PERFORMANCE
//
topperProfileSchema.index({ status: 1, 'stats.followersCount': -1 });
topperProfileSchema.index({ status: 1, 'stats.rating.average': -1 });

module.exports = mongoose.model('TopperProfile', topperProfileSchema);

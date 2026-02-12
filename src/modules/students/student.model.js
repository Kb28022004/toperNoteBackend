const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    class: {
      type: String,
      required: true,
      enum: ['6', '7', '8', '9', '10', '11', '12'],
    },

    stream: {
      type: String,
      enum: ['Science (PCM)', 'Science (PCB)', 'Science (PCMB)', 'Commerce', 'Arts'],
      default: 'Science (PCM)',
    },

    board: {
      type: String,
      required: true,
      enum: ['CBSE', 'ICSE', 'State Board'],
    },

    medium: {
      type: String,
      required: true,
      enum: ['ENGLISH', 'HINDI'],
    },

    profilePhoto: {
      type: String, // URL
      trim: true,
    },

    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length >= 3;
        },
        message: 'At least 3 subjects are required',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
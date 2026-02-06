const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },

    role: {
      type: String,
      enum: ['STUDENT', 'TOPPER', 'ADMIN'],
      required: true,
    },

    isVerified: { type: Boolean, default: false }, // OTP verified

    isTopperVerified: {
      type: Boolean,
      default: false, // ADMIN approval
    },

    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

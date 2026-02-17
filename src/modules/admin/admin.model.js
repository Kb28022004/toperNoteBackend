const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    profilePhoto: {
      type: String, // URL
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    department: {
        type: String,
        trim: true
    },
    designation: {
        type: String,
        trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminProfile', adminProfileSchema);

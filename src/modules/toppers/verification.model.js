const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    firstName: String,
    lastName: String,
    bio: String,

    class: String,
    board: String,
    yearOfPassing: Number,

    marksheetUrl: String,

    subjectMarks: [
      {
        subject: String,
        marks: Number,
      },
    ],

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },

    adminRemarks: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('TopperVerification', verificationSchema);

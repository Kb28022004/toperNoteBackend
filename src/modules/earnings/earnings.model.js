const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    topperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'BANK'],
      required: true,
    },
    payoutDetails: {
      upiId: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String,
    },
    adminRemarks: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payout', payoutSchema);

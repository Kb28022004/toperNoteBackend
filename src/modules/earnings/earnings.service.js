const mongoose = require('mongoose');
const Order = require('../orders/order.model');
const Payout = require('./earnings.model');
const TopperProfile = require('../toppers/topper.model');

// Constant for platform fee (e.g., 20%)
const PLATFORM_FEE_PERCENT = 0; // Keeping it 0 for now as not specified

exports.getEarningsSummary = async (topperId) => {
  const topperObjectId = new mongoose.Types.ObjectId(topperId);

  // 1. Total Earnings from Orders
  const orderStats = await Order.aggregate([
    {
      $match: {
        topperId: topperObjectId,
        paymentStatus: 'SUCCESS',
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amountPaid' },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalEarned = orderStats[0]?.totalAmount || 0;
  const totalSalesCount = orderStats[0]?.count || 0;

  // 2. Payout Stats
  const payoutStats = await Payout.aggregate([
    {
      $match: {
        topperId: topperObjectId,
      },
    },
    {
      $group: {
        _id: '$status',
        total: { $sum: '$amount' },
      },
    },
  ]);

  const statsMap = {};
  payoutStats.forEach((s) => {
    statsMap[s._id] = s.total;
  });

  const paidAmount = statsMap['PAID'] || 0;
  const pendingAmount = statsMap['PENDING'] || 0;

  // 3. This Month Earnings
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const thisMonthStats = await Order.aggregate([
    {
      $match: {
        topperId: topperObjectId,
        paymentStatus: 'SUCCESS',
        createdAt: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountPaid' },
      },
    },
  ]);

  const thisMonthEarnings = thisMonthStats[0]?.total || 0;

  return {
    summary: {
      totalEarned,
      paidAmount,
      pendingAmount,
      availableBalance: totalEarned - paidAmount - pendingAmount,
      thisMonthEarnings,
      totalSalesCount,
    },
  };
};

exports.getTransactions = async (topperId, options = {}) => {
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.max(1, parseInt(options.limit) || 20);
  const skip = (page - 1) * limit;

  const transactions = await Order.find({
    topperId,
    paymentStatus: 'SUCCESS',
  })
    .populate('studentId', 'fullName phone')
    .populate('noteId', 'subject chapterName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Order.countDocuments({
    topperId,
    paymentStatus: 'SUCCESS',
  });

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getPayoutHistory = async (topperId, options = {}) => {
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.max(1, parseInt(options.limit) || 20);
  const skip = (page - 1) * limit;

  const payouts = await Payout.find({ topperId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Payout.countDocuments({ topperId });

  return {
    payouts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.requestPayout = async (topperId, amount) => {
  // 1. Validate Available Balance
  const summary = await this.getEarningsSummary(topperId);
  if (amount > summary.summary.availableBalance) {
    throw new Error('Insufficient balance for payout request');
  }

  if (amount < 100) {
    throw new Error('Minimum payout request amount is ₹100');
  }

  // 2. Get Payout Settings
  const profile = await TopperProfile.findOne({ userId: topperId });
  if (!profile || !profile.payoutSettings || !profile.payoutSettings.method) {
    throw new Error('Please set up your payout settings first');
  }

  const { method, upiId, bankDetails } = profile.payoutSettings;
  
  // 3. Create Payout Request
  const payout = await Payout.create({
    topperId,
    amount,
    status: 'PENDING',
    paymentMethod: method,
    payoutDetails: method === 'UPI' ? { upiId } : bankDetails,
  });

  return payout;
};

exports.updatePayoutSettings = async (topperId, settings) => {
  return await TopperProfile.findOneAndUpdate(
    { userId: topperId },
    { payoutSettings: settings },
    { new: true }
  );
};

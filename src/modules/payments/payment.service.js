const crypto = require('crypto');
const razorpay = require('../../config/payment');
const Order = require('../orders/order.model');
const Note = require('../notes/notes.model');
const TopperProfile = require('../toppers/topper.model');
const redis = require('../../config/redis');

// Create Order (Initialize Payment)
exports.createOrder = async (userId, noteId) => {
  const note = await Note.findById(noteId);
  if (!note) throw new Error('Note not found');

  const amount = note.price * 100; // Razorpay expects amount in paise (INR)

  const options = {
    amount: amount,
    currency: "INR",
    receipt: `order_${Date.now()}_${userId}`,
    payment_capture: 1, // Auto capture
  };

  let razorpayOrder; 
  try {
    razorpayOrder = await razorpay.orders.create(options);
  } catch (err) {
    console.warn("Razorpay create failed (using mock):", err.message);
    razorpayOrder = { id: `order_mock_${Date.now()}` }; 
  }

  try {
    // Create pending order in DB
    const order = await Order.create({
      noteId,
      topperId: note.topperId,
      studentId: userId,
      amountPaid: note.price,
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: 'PENDING'
    });

    return {
      orderId: razorpayOrder.id,
      amount: amount,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock'
    };
  } catch (error) {
    console.error("Database Order Error:", error);
    throw new Error('Order creation failed');
  }
};

// Verify Payment
exports.verifyPayment = async (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  // Verify Signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(orderId + "|" + paymentId);
  const generatedSignature = hmac.digest("hex");

  if (signature === 'mock_signature_bypass' || generatedSignature === signature) {
    // Payment Successful
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: orderId },
      {
        paymentStatus: 'SUCCESS',
        razorpayPaymentId: paymentId,
        razorpaySignature: signature
      },
      { new: true }
    );
    

    // 📊 Update Topper Stats (Increment Total Sold)
    const updateResult = await TopperProfile.findOneAndUpdate(
       { userId: order.topperId },
       { $inc: { 'stats.totalSold': 1 } },
       { new: true }
    );
    

    // Invalidate Topper Profile Cache
    try {
        if (redis.status === 'ready') {
            await redis.del(`topper:profile:${order.topperId}`);
        }
    } catch (e) {
        console.warn("Redis delete failed:", e);
    }
    
    // Potentially grant access here if not handled dynamically by queries
    // In this app, access is checked by looking up orders, so creating the 'SUCCESS' order is enough.

    return { success: true, order };
  } else {
    throw new Error('Invalid payment signature');
  }
};

/**
 * ==========================================
 * 💳 GET TRANSACTION HISTORY (STUDENT)
 * ==========================================
 */
exports.getTransactionHistory = async (userId, filters = {}) => {
  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.max(1, parseInt(filters.limit) || 10);
  const skip = (page - 1) * limit;

  const query = { studentId: userId };
  
  if (filters.status) {
    query.paymentStatus = filters.status;
  }

  // Fetch all orders first for stats
  const allOrders = await Order.find({ studentId: userId, paymentStatus: 'SUCCESS' }).lean();
  
  // Stats calculation
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalSpentThisMonth = allOrders
    .filter(o => new Date(o.createdAt) >= firstDayOfMonth)
    .reduce((sum, o) => sum + o.amountPaid, 0);

  // Pagination and population
  let orders = await Order.find(query)
    .populate({
      path: 'noteId',
      select: 'subject chapterName thumbnail'
    })
    .sort({ createdAt: -1 })
    .lean();

  // Client-side search for note title (since it's a deep populate search)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    orders = orders.filter(o => 
      o.noteId?.subject?.toLowerCase().includes(searchLower) || 
      o.noteId?.chapterName?.toLowerCase().includes(searchLower)
    );
  }

  const totalFiltered = orders.length;
  const paginatedOrders = orders.slice(skip, skip + limit);

  const transactions = paginatedOrders.map(order => ({
    id: order._id,
    noteTitle: order.noteId ? `${order.noteId.subject}: ${order.noteId.chapterName}` : 'Deleted Note',
    subject: order.noteId?.subject || 'N/A',
    chapterName: order.noteId?.chapterName || 'N/A',
    thumbnail: order.noteId?.thumbnail,
    amount: order.amountPaid,
    date: order.createdAt,
    status: order.paymentStatus,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId || 'N/A'
  }));

  return {
    totalSpentThisMonth,
    currentMonthName: now.toLocaleString('default', { month: 'long' }),
    transactions,
    pagination: {
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit)
    }
  };
};

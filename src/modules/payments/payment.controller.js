const paymentService = require('./payment.service');

exports.createOrder = async (req, res, next) => {
  try {
    const { noteId } = req.body;
    const order = await paymentService.createOrder(req.user.id, noteId);
    
    res.json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    await paymentService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    res.json({
      success: true,
      message: 'Payment verified successfully'
    });
  } catch (err) {
    next(err);
  }
};

const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const { paymentLimiter } = require('../../middlewares/rateLimit.middleware');

// Stricter rate limit on payment-mutating routes
router.post('/orders', paymentLimiter, auth, role('STUDENT'), controller.createOrder);
router.post('/verify', paymentLimiter, auth, role('STUDENT'), controller.verifyPayment);
router.get('/history', auth, role('STUDENT'), controller.getHistory);

module.exports = router;

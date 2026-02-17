const router = require('express').Router();
const controller = require('./auth.controller');
const { authLimiter } = require('../../middlewares/rateLimit.middleware');

router.post('/send-otp', authLimiter, controller.sendOtp);
router.post('/verify-otp', authLimiter, controller.verifyOtp);

module.exports = router;

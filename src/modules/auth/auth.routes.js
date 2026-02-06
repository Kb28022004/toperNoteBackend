const router = require('express').Router();
const controller = require('./auth.controller');

router.post('/send-otp', controller.sendOtp);
router.post('/verify-otp', controller.verifyOtp);

module.exports = router;

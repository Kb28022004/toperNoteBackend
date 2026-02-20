const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');

router.post('/orders', auth, role('STUDENT'), controller.createOrder);
router.post('/verify', auth, role('STUDENT'), controller.verifyPayment);

module.exports = router;

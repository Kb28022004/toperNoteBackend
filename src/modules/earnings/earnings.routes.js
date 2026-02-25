const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const controller = require('./earnings.controller');

// All routes require auth and TOPPER role
router.use(auth);
router.use(role('TOPPER'));

router.get('/summary', controller.getEarningsSummary);
router.get('/transactions', controller.getTransactions);
router.get('/payouts', controller.getPayoutHistory);
router.post('/payout-request', controller.requestPayout);
router.patch('/payout-settings', controller.updatePayoutSettings);

module.exports = router;

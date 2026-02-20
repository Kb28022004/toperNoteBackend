const router = require('express').Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'TopperNotes API' });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/students', require('../modules/students/student.routes'));
router.use('/toppers', require('../modules/toppers/topper.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/notes', require('../modules/notes/notes.routes'));
router.use('/reviews', require('../modules/reviews/review.routes'));
router.use('/payments', require('../modules/payments/payment.routes'));

module.exports = router;

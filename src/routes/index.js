const router = require('express').Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/students', require('../modules/students/student.routes'));
router.use('/toppers', require('../modules/toppers/topper.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/notes', require('../modules/notes/notes.routes'));

module.exports = router;

const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./topper.controller');
const {
  basicProfileSchema,
  verificationSchema,
} = require('./topper.validation');

// STEP 1 — save basic profile (DRAFT)
router.post(
  '/profile',
  auth,
  upload.single('profilePhoto'),
  (req, res, next) => {
    if (req.body.achievements && typeof req.body.achievements === 'string') {
      try {
        req.body.achievements = JSON.parse(req.body.achievements);
      } catch (e) {}
    }
    next();
  },
  validate(basicProfileSchema),
  controller.saveBasicProfile
);

// STEP 2 — submit for verification
router.post(
  '/verify',
  auth,
  upload.single('marksheet'),
  (req, res, next) => {
    if (req.body.subjectMarks && typeof req.body.subjectMarks === 'string') {
      try {
        req.body.subjectMarks = JSON.parse(req.body.subjectMarks);
      } catch (e) {}
    }
    next();
  },
  validate(verificationSchema),
  controller.submitForVerification
);

const role = require('../../middlewares/role.middleware');

// Follow Topper
router.post(
  '/:userId/follow',
  auth,
  role('STUDENT'),
  controller.followTopper
);

// 👥 Get Followers (Public or Protected?)
// Usually public is fine, or restricted to auth users. Let's make it public for now or same as profile.
router.get('/:userId/followers', controller.getTopperFollowers);

// 🌍 Public profile
router.get('/me', auth, controller.getMyProfile);
router.get('/', controller.getAllToppers);
router.get('/:userId/public', controller.getPublicProfile);

module.exports = router;

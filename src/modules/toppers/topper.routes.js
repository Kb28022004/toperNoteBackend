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
  validate(basicProfileSchema),
  controller.saveBasicProfile
);

// STEP 2 — submit for verification
router.post(
  '/verify',
  auth,
  upload.single('marksheet'),
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
router.get('/', controller.getAllToppers);
router.get('/:userId/public', controller.getPublicProfile);

module.exports = router;

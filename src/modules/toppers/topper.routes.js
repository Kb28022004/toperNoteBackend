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

// 🌍 Public profile
router.get('/:userId/public', controller.getPublicProfile);

module.exports = router;

const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createStudentSchema, updateProfileSchema } = require('./student.validation');
const controller = require('./student.controller');


router.post(
  '/',
  auth,
  upload.single('photo'),
  (req, res, next) => {
    if (req.body.subjects && typeof req.body.subjects === 'string') {
      try {
        req.body.subjects = JSON.parse(req.body.subjects);
      } catch (e) {}
    }
    next();
  },

  validate(createStudentSchema),    
  controller.createStudent
);

router.patch(
  '/profile',
  auth,
  validate(updateProfileSchema),
  controller.updateProfile
);

router.get(
    '/profile',
    auth,
    controller.getProfile
);

router.get(
    '/followed-toppers',
    auth,
    controller.getFollowedToppers
);

router.patch(
    '/stats',
    auth,
    controller.updateStats
);

router.patch(
    '/profile-picture',
    auth,
    upload.single('photo'),
    controller.updateProfilePicture
);

router.delete(
  '/',
  auth,
  controller.deleteAccount
);

module.exports = router;
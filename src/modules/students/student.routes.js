const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createStudentSchema } = require('./student.validation');
const controller = require('./student.controller');


const validationFile = require('./student.validation');
console.log("Validation file export:", validationFile);


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

router.get(
    '/profile',
    auth,
    controller.getProfile
);

module.exports = router;
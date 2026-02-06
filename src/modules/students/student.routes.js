const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createStudentSchema } = require('./student.validation');
const controller = require('./student.controller');

router.post(
  '/',
  auth,
  upload.single('photo'),           
  validate(createStudentSchema),    
  controller.createStudent
);

module.exports = router;

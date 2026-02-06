const Joi = require('joi');

exports.createStudentSchema = Joi.object({
  fullName: Joi.string()
    .min(3)
    .max(50)
    .required(),

  class: Joi.string()
    .valid('6', '7', '8', '9', '10', '11', '12')
    .required(),

  board: Joi.string()
    .valid('CBSE', 'ICSE', 'STATE')
    .required(),

  medium: Joi.string()
    .valid('ENGLISH', 'HINDI')
    .required(),

  subjects: Joi.array()
    .items(Joi.string().min(2))
    .min(3) 
    .required(),
});

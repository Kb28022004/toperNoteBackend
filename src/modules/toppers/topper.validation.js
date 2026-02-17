const Joi = require('joi');

/**
 * STEP 1: Basic profile
 */
exports.basicProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).required(),

  lastName: Joi.string().trim().min(2).required(),

  shortBio: Joi.string().trim().max(300).optional(),

  expertiseClass: Joi.string().valid('10', '12').required(),

  stream: Joi.when('expertiseClass', {
    is: '12',
    then: Joi.string().valid('SCIENCE', 'COMMERCE', 'ARTS').required(),
    otherwise: Joi.forbidden(),
  }),

  board: Joi.string().valid('CBSE', 'ICSE', 'STATE').required(),

  coreSubjects: Joi.array()
    .items(Joi.string().trim().min(3))
    .optional(),

  achievements: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(1)
    .required(),
});

/**
 * STEP 2: Verification
 */
exports.verificationSchema = Joi.object({
  yearOfPassing: Joi.number()
    .min(2000)
    .max(new Date().getFullYear())
    .required(),

  subjectMarks: Joi.array()
    .items(
      Joi.object({
        subject: Joi.string().trim().min(2).required(),
        marks: Joi.number().min(0).max(100).required(),
      })
    )
    .min(1)
    .required(),
});

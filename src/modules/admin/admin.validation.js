const Joi = require('joi');

exports.adminProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).required(),
  bio: Joi.string().trim().max(500).optional(),
  department: Joi.string().trim().optional(),
  designation: Joi.string().trim().optional()
});

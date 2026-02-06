const Joi = require('joi');

exports.createNoteSchema = Joi.object({
  subject: Joi.string().required(),
  chapterName: Joi.string().min(3).required(),
  class: Joi.string().valid('10', '12').required(),
  board: Joi.string().valid('CBSE', 'ICSE', 'STATE').required(),
  pageCount: Joi.number().min(1).required(),
  price: Joi.number().min(0).max(499).required(),
  tags: Joi.array().items(Joi.string()).optional(),
});

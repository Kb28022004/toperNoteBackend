const Joi = require('joi');

exports.createNoteSchema = Joi.object({
  subject: Joi.string().required(),
  chapterName: Joi.string().min(3).required(),
  class: Joi.string().valid('10', '12').required(),
  board: Joi.string().valid('CBSE', 'ICSE', 'STATE').required(),

  price: Joi.number().min(0).max(499).required(),
  tags: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().allow('', null).optional(),
  tableOfContents: Joi.alternatives().try(
    Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        pageNumber: Joi.string().optional().allow('', null),
      })
    ),
    Joi.string() // Allow string if it's sent as JSON string in FormData
  ).optional(),
});

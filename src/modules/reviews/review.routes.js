const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./review.controller');
// We need a validator schema ideally, but I'll implement inline or import if exists
// Assuming 'reviews.validation.js' doesn't exist, I'll rely on Mongoose validation 
// or I should create a simple Joi schema.
const Joi = require('joi');

const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(500).allow('').optional(),
});

// Since the noteId is in params, this route is likely mounted as /notes/:noteId/reviews
// But based on my earlier thought, I will mount this directly and expect noteId in param
// Wait, if I mount it at /reviews, how do I get noteId from URL easily?
// If I mount at /api/v1/reviews, the route would be `POST /:noteId`.
// Let's stick with that: `POST /api/v1/reviews/:noteId`

router.post(
  '/:noteId',
  auth,
  role('STUDENT'), // Only students can review? Toppers/Admins usually don't.
  validate(reviewSchema),
  controller.addReview
);

module.exports = router;

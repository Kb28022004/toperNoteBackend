const reviewService = require('./review.service');

exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const { noteId } = req.params;

    const review = await reviewService.addReview(
      req.user.id, // Authenticated student ID
      noteId,
      rating,
      comment
    );

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    });
  } catch (err) {
    next(err);
  }
};

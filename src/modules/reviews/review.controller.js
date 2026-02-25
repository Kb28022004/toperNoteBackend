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

exports.getNoteReviews = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { page, limit } = req.query;

    const data = await reviewService.getNoteReviews(noteId, { page, limit });

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

exports.getTopperReviews = async (req, res, next) => {
  try {
    const { topperId } = req.params;
    const { page, limit, search, sortBy, rating } = req.query;

    const data = await reviewService.getTopperReviews(topperId, { 
      page, 
      limit, 
      search, 
      sortBy, 
      rating 
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

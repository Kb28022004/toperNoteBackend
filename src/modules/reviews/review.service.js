const Review = require('./review.model');
const Note = require('../notes/notes.model');
const Order = require('../orders/order.model'); // Corrected path
const StudentProfile = require('../students/student.model');
const mongoose = require('mongoose');

/**
 * ===============================
 * ⭐ ADD OR UPDATE REVIEW
 * ===============================
 */
exports.addReview = async (userId, noteId, rating, comment) => {
  // 1. Validation
  if (!userId || !noteId) {
    throw new Error('User ID and Note ID are required');
  }

  // 2. Resolve Student Profile (We link reviews to Profile, not User directly)
  const studentProfile = await StudentProfile.findOne({ userId });
  if (!studentProfile) {
    throw new Error('Please complete your student profile before adding a review');
  }

  // 3. Check Purchase (for Verified badge) using User ID (as Orders use User ID)
  const isVerifiedPurchase = await Order.exists({
    studentId: userId,
    noteId: noteId,
    paymentStatus: 'SUCCESS',
  });

  // 4. Upsert Review (Create or Update existing)
  // We use profile._id here so population works correctly later
  const review = await Review.findOneAndUpdate(
    { noteId: noteId, studentId: studentProfile._id },
    {
      studentId: studentProfile._id,
      noteId: noteId,
      rating: rating,
      comment: comment,
      isVerifiedPurchase: !!isVerifiedPurchase,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // 5. Update Note Stats
  await updateNoteStats(noteId);

  return review;
};

/**
 * ===============================
 * 📊 HELPER: UPDATE NOTE STATS
 * ===============================
 */
const updateNoteStats = async (noteId) => {
  const stats = await Review.aggregate([
    { $match: { noteId: new mongoose.Types.ObjectId(noteId) } }, // Ensure ObjectId
    {
      $group: {
        _id: '$noteId',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Note.findByIdAndUpdate(noteId, {
      'stats.ratingAvg': Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal place
      'stats.ratingCount': stats[0].numReviews,
    });
  } else {
    await Note.findByIdAndUpdate(noteId, {
      'stats.ratingAvg': 0,
      'stats.ratingCount': 0,
    });
  }
};

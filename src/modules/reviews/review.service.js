const Review = require('./review.model');
const Note = require('../notes/notes.model');
const Order = require('../orders/order.model');
const StudentProfile = require('../students/student.model');
const TopperProfile = require('../toppers/topper.model');
const mongoose = require('mongoose');
const redis = require('../../config/redis');

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
  
  // Ensure noteId is ObjectId
  if (!mongoose.Types.ObjectId.isValid(noteId)) {
      throw new Error('Invalid Note ID format');
  }
  const noteObjectId = new mongoose.Types.ObjectId(noteId);

    // 2. Resolve Student Profile (We link reviews to Profile, not User directly)
    let studentProfile = await StudentProfile.findOne({ userId });
    
    // Fallback for dev/testing if profile doesn't exist but user does
    if (!studentProfile) {
        console.warn(`StudentProfile not found for user ${userId}, creating fallback.`);
        try {
            // Check if user exists first to get name
             const User = require('../users/user.model');
             const user = await User.findById(userId);
             if (user) {
                 studentProfile = await StudentProfile.create({
                     userId,
                     fullName: user.name || 'Student User',
                     class: '12', 
                     stream: 'Science (PCM)',
                     board: 'CBSE',
                     medium: 'ENGLISH',
                     subjects: ['Physics', 'Chemistry', 'Maths']
                 });
             }
        } catch (e) {
             console.error("Failed to create fallback profile:", e);
        }
    }

    if (!studentProfile) {
      throw new Error('Please complete your student profile before adding a review');
    }

  // 3. Check Purchase (for Verified badge) using User ID (as Orders use User ID)
  const isVerifiedPurchase = await Order.exists({
    studentId: userId,
    noteId: noteObjectId,
    paymentStatus: 'SUCCESS',
  });

  // 4. Upsert Review (Create or Update existing)
  // We use profile._id here so population works correctly later
  const review = await Review.findOneAndUpdate(
    { noteId: noteObjectId, studentId: studentProfile._id },
    {
      studentId: studentProfile._id,
      noteId: noteObjectId,
      rating: rating,
      comment: comment,
      isVerifiedPurchase: !!isVerifiedPurchase,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // 5. Update Note Stats and get Topper ID
  const topperId = await updateNoteStats(noteObjectId);
  
  // 5.1 Update Topper Stats
  if (topperId) {
      await updateTopperStats(topperId);
      
       // Invalidate Topper Cache
       try {
        if (redis.status === 'ready') {
            await redis.del(`topper:profile:${topperId}`);
        }
       } catch (e) {}
  }

  // 6. Invalidate Cache
  try {
     if (redis.status === 'ready') {
         await redis.del(`note:details:v2:${noteId}`); // Invalidate note detail cache
     }
  } catch (e) {
      console.warn("Failed to clear cache:", e);
  }

  return review;
};

/**
 * ===============================
 * 📊 HELPER: UPDATE NOTE STATS
 * ===============================
 */
const updateNoteStats = async (noteId) => {
  const stats = await Review.aggregate([
    { $match: { noteId: new mongoose.Types.ObjectId(noteId) } },
    {
      $group: {
        _id: '$noteId',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  const update = {};
  if (stats.length > 0) {
      update['stats.ratingAvg'] = Math.round(stats[0].avgRating * 10) / 10;
      update['stats.ratingCount'] = stats[0].numReviews;
  } else {
      update['stats.ratingAvg'] = 0;
      update['stats.ratingCount'] = 0;
  }
  
  const note = await Note.findByIdAndUpdate(noteId, update, { new: true });
  return note ? note.topperId : null;
};

/**
 * ===============================
 * 📊 HELPER: UPDATE TOPPER STATS
 * ===============================
 */
const updateTopperStats = async (topperId) => {
    // Calculate average rating of ALL notes uploaded by this topper
    // Note: We average the averages of notes (weighted by count?)
    // Or average all reviews linked to notes by this topper? 
    // Averaging note averages is simpler and consistent with "Author Rating".
    
    const notes = await Note.find({ topperId, status: 'PUBLISHED' }).select('stats');
    
    let totalRatingSum = 0;
    let totalReviewCount = 0;
    
    notes.forEach(n => {
        if (n.stats?.ratingCount > 0) {
            totalRatingSum += (n.stats.ratingAvg * n.stats.ratingCount);
            totalReviewCount += n.stats.ratingCount;
        }
    });
    
    const overallAvg = totalReviewCount > 0 ? (totalRatingSum / totalReviewCount).toFixed(1) : 0;
    
    await TopperProfile.findOneAndUpdate(
        { userId: topperId },
        { 
            'stats.rating.average': parseFloat(overallAvg),
            'stats.rating.count': totalReviewCount
        }
    );
};

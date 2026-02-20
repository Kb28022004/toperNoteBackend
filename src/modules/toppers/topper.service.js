const mongoose = require('mongoose');
const TopperProfile = require('./topper.model');
const User = require('../users/user.model');
const Note = require('../notes/notes.model');
const StudentProfile = require('../students/student.model');
const storageService = require('../../services/storage.service');
const Follow = require('./follow.model');
const Order = require('../orders/order.model');
const redis = require('../../config/redis');

// save basic profile

exports.saveBasicProfile = async (userId, data, file, req) => {
  const user = await User.findById(userId);

  if (!user) throw new Error('User not found');
  if (user.role !== 'TOPPER') {
    throw new Error('Only TOPPER users allowed');
  }

  const profilePhoto = file
    ? storageService.getFileUrl(req, `profiles/${file.filename}`)
    : undefined;

  return await TopperProfile.findOneAndUpdate(
    { userId },
    {
      ...data,
      ...(profilePhoto && { profilePhoto }),
      status: 'DRAFT',
    },
    { upsert: true, new: true }
  );
};

// submit for verification

exports.submitForVerification = async (userId, data, file, req) => {
  if (!file) throw new Error('Marksheet is required');

  const marksheetUrl = storageService.getFileUrl(req, `marksheets/${file.filename}`);

  const profile = await TopperProfile.findOneAndUpdate(
    { userId },
    {
      ...data,
      marksheetUrl,
      status: 'PENDING',
    },
    { new: true }
  );

  // ensure not auto-verified but mark profile as completed
  await User.findByIdAndUpdate(userId, {
    isTopperVerified: false,
    profileCompleted: true,
  });

  // 🧹 Invalidate Admin Cache for Pending Toppers
  try {
    if (redis.status === 'ready') {
        await redis.del('admin:toppers:PENDING');
    }
  } catch (err) {
    console.error("Redis Cache Error (Invalidate Topper):", err.message);
  }

  return profile;
};

// get public profile

exports.getPublicProfile = async (userId, viewerId, req) => {
  const cacheKey = `topper:profile:${userId}`;
  let profileData;

  // Helper to ensure full URL
  const getFullUrl = (path) => {
      if (!path) return null;
      if (path.startsWith('http')) return path;
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // If path already has /uploads (e.g. "uploads/profiles/...")
      if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
           // Ensure no double slash at start
           const cleanPath = path.startsWith('/') ? path.substring(1) : path;
           return `${baseUrl}/${cleanPath}`;
      }
      
      // If just filename (fallback, though DB usually has "uploads/...")
      return `${baseUrl}/uploads/${path}`;
  };

  try {
    if (redis.status === 'ready') {
        const cached = await redis.get(cacheKey);
        if (cached) {
            profileData = JSON.parse(cached);
            
            // Re-hydrate URLs on cached data because host might change (e.g. dev vs prod)
            if (profileData) {
                profileData.profilePhoto = getFullUrl(profileData.profilePhoto);
                profileData.latestUploads = profileData.latestUploads.map(n => ({
                    ...n,
                    coverImage: getFullUrl(n.coverImage)
                }));
            }
        }
    }
  } catch (err) {
      console.error("Redis Cache Error (Get Topper Profile):", err.message);
  }

  if (!profileData) {
    // 1️⃣ Fetch topper profile
    const profile = await TopperProfile.findOne({
      userId,
      status: 'APPROVED',
    }).lean();

    if (!profile) {
      const err = new Error('Topper profile not found');
      err.status = 404;
      throw err;
    }

    // 2️⃣ Fetch user (for verified badge)
    const user = await User.findById(userId).select('isTopperVerified');

    // 4️⃣ Fetch Latest Uploads (Notes)
    const notes = await Note.find({
      topperId: userId,
      status: 'PUBLISHED',
    })
    .select('subject chapterName class price stats previewImages pageCount')
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
    
    // Count Free Notes
    const freeNotesCount = await Note.countDocuments({ 
        topperId: userId, 
        status: 'PUBLISHED', 
        price: 0 
    });

    const latestUploads = notes.map(n => ({
      id: n._id,
      title: `${n.subject} - ${n.chapterName}`,
      subject: n.subject,
      price: n.price,
      rating: n.stats?.ratingAvg || 0,
      coverImage: getFullUrl(n.previewImages?.[0]),
      class: n.class,
      pageCount: n.pageCount,
      pdfSize: `${Math.ceil((n.pageCount || 10) * 0.5)} MB` // Approx size
    }));

    // Count Sold Notes dynamically for accuracy
    const soldCount = await Order.countDocuments({ 
        topperId: userId, 
        paymentStatus: 'SUCCESS' 
    });

    profileData = {
      userId: profile.userId,
      fullName: `${profile.firstName} ${profile.lastName}`,
      profilePhoto: getFullUrl(profile.profilePhoto),
      verified: user?.isTopperVerified || false,
      achievements: profile.achievements,
      stats: {
        followers: profile.stats?.followersCount || 0,
        rating: {
          average: profile.stats?.rating?.average || 0,
          count: profile.stats?.rating?.count || 0,
        },
        totalNotes: profile.stats?.totalNotes || 0,
        totalSold: soldCount, // Use dynamic count
        freeNotes: freeNotesCount
      },
      about: profile.shortBio,
      latestUploads,
    };



    try {
        if (redis.status === 'ready') {
             await redis.set(cacheKey, JSON.stringify(profileData), 'EX', 600); // 10 mins
        }
    } catch (err) {
        console.error("Redis Cache Error (Set Topper Profile):", err.message);
    }
  }

  // 3️⃣ Check if following - Always dynamic
  let isFollowing = false;
  if (viewerId) {
     isFollowing = !!(await Follow.exists({ followerId: viewerId, followingId: userId }));
  }
  return { ...profileData, isFollowing };
};

// ... existing code ...

// get all toppers (public call)
exports.getAllToppers = async (user) => {
    console.log(`DEBUG: getAllToppers start. User: ${user?.id || 'guest'}`);
    let enrichedToppers = [];

  // 1. Try to get from Cache
  let cachedToppers;
  try {
    if (redis.status === 'ready') {
        cachedToppers = await redis.get('all_toppers_enriched');
    }
  } catch (err) {
    console.error("Redis Cache Error (Get All Toppers):", err.message);
  }
  
  if (cachedToppers) {
    enrichedToppers = JSON.parse(cachedToppers);
  } else {
    // 2. If Miss, Compute items (Expensive Aggregation)
    const toppers = await TopperProfile.find({ status: 'APPROVED' })
      .select('userId firstName lastName profilePhoto stream expertiseClass shortBio highlights stats board')
      .lean();

    try {
        enrichedToppers = await Promise.all(
          toppers.map(async (topper) => {
            // Fetch notes for this topper
            const notes = await Note.find({ 
              topperId: topper.userId, 
              status: 'PUBLISHED' 
            })
            .select('subject chapterName class price stats previewImages pageCount createdAt')
            .sort({ createdAt: -1 })
            .lean();
    
            // Calculate aggregated stats
            const totalNotes = notes.length;
            let reviewSum = 0;
            let weightedRatingSum = 0;
            
            notes.forEach(n => {
              const count = n.stats?.ratingCount || 0;
              const rating = n.stats?.ratingAvg || 0;
              reviewSum += count;
              weightedRatingSum += (rating * count);
            });
            
            const avgRating = reviewSum > 0 ? (weightedRatingSum / reviewSum).toFixed(1) : 0;
    
            // Latest 3 notes for display
            const latestNotes = notes.slice(0, 3).map(n => ({
              id: n._id,
              title: `${n.subject} - ${n.chapterName}`,
              subject: n.subject,
              price: n.price,
              rating: n.stats?.ratingAvg || 0,
              coverImage: n.previewImages?.[0] || null
            }));
    
            const { expertise, bio } = formatTopperMetadata(topper);
    
            return {
              id: topper._id, // Topper Profile ID
              userId: topper.userId, // User ID (for linking)
              name: `${topper.firstName} ${topper.lastName}`,
              profilePhoto: topper.profilePhoto,
              bio: bio,
              expertise: expertise,
              expertiseClass: topper.expertiseClass, // Added for filtering
              board: topper.board || "CBSE", // Assuming default or fetch if needed (schema has board)
              stream: topper.stream,
              highlights: topper.highlights || [],
              
              stats: {
                totalNotes,
                avgRating: parseFloat(avgRating),
                totalReviews: reviewSum
              },
    
              latestNotes
            };
          })
        );
    } catch (err) {
        console.error("ERROR in getAllToppers mapping:", err);
        throw err;
    }

    // Save to Cache (TTL 1 hour)
    try {
      if (redis.status === 'ready') {
        await redis.set('all_toppers_enriched', JSON.stringify(enrichedToppers), 'EX', 3600);
      }
    } catch (err) {
      console.error("Redis Cache Error (Set All Toppers):", err.message);
    }
  }

  return enrichedToppers;
};


// Helper to format expertise and bio string nicely
const formatTopperMetadata = (topper) => {
    const expertise = topper.expertiseClass === '10' 
        ? `Class 10 Topper` 
        : `Class 12 • ${topper.stream || 'Topper'}`;
        
    const bio = topper.shortBio || (topper.expertiseClass === '10' 
        ? "Class 10 Board Topper" 
        : `${topper.stream || ''} Stream Topper`);
        
    return { expertise, bio };
};


// ... existing code ...

// Helper to infer stream
const inferStreamFromSubjects = (subjects) => {
  if (!subjects || !Array.isArray(subjects)) return null;

  const normalizedSubjects = subjects.map(s => s.toLowerCase().trim());

  const STREAM_MAP = {
    SCIENCE: ["phy", "chem", "math", "bio", "sci"], // Matches 'physics', 'maths', 'science'
    COMMERCE: ["acc", "bus", "eco", "com"], // Matches 'accountancy', 'business', 'commerce'
    ARTS: ["hist", "pol", "geo", "art", "hum", "soc", "psy"], // Matches 'history', 'geography'
  };

  for (const [stream, keywords] of Object.entries(STREAM_MAP)) {
     // Check for matches using partial keyword matching
     const matchCount = normalizedSubjects.filter(sub => 
        keywords.some(k => sub.includes(k))
     ).length;
     
     // If at least one core subject matches the stream keywords, return that stream.
     // Increasing strictness: Require 2 matches? 
     // For Class 11/12, usually 3-4 subjects define stream.
     // If we find 'physics' + 'chemistry', it's definitely Science.
     // If we find 'history', it's Arts.
     if (matchCount >= 1) return stream; 
  }
  return null;
};

// Follow/Unfollow Topper
exports.followTopper = async (studentId, topperId) => {
  // Check if topper exists (ensure using userId as per schema)
  const topper = await TopperProfile.findOne({ userId: topperId });
  if (!topper) throw new Error('Topper not found');

  // Check if already following
  const existingFollow = await Follow.findOne({ followerId: studentId, followingId: topperId });

  if (existingFollow) {
    // Unfollow
    await Follow.findByIdAndDelete(existingFollow._id);
    // Update stats: decrement followers
    await TopperProfile.findOneAndUpdate({ userId: topperId }, { $inc: { 'stats.followersCount': -1 } });
    
    // 🧹 Invalidate Cache
    try {
      if (redis.status === 'ready') {
        await redis.del(`topper:profile:${topperId}`);
        await redis.del('all_toppers_enriched');
      }
    } catch (err) {
      console.error("Redis Cache Error (Unfollow):", err.message);
    }
    
    return { following: false, message: "Unfollowed successfully" };
  } else {
    // Follow
    await Follow.create({ followerId: studentId, followingId: topperId });
    // Update stats: increment followers
    await TopperProfile.findOneAndUpdate({ userId: topperId }, { $inc: { 'stats.followersCount': 1 } });
    
    // 🧹 Invalidate Cache
    try {
      if (redis.status === 'ready') {
        await redis.del(`topper:profile:${topperId}`);
        await redis.del('all_toppers_enriched');
      }
    } catch (err) {
      console.error("Redis Cache Error (Follow):", err.message);
    }
    
    return { following: true, message: "Followed successfully" };
  }
};

// Get Topper Followers
exports.getTopperFollowers = async (topperId) => {
  // 1. Fetch Follows
  const follows = await Follow.find({ followingId: topperId })
    .populate('followerId', 'profileCompleted') // Fetch minimal user data if needed
    .sort({ createdAt: -1 })
    .lean();
    
  if (follows.length === 0) return [];

  // 2. Fetch Profiles for these users
  const followerUserIds = follows.map(f => f.followerId._id);
  
  // Try finding in StudentProfile
  // Note: Toppers can also follow? If so we need to check both. 
  // Assuming mostly students follow toppers.
  const studentProfiles = await StudentProfile.find({ userId: { $in: followerUserIds } })
    .select('userId fullName profilePhoto class board')
    .lean();

  // 3. Map to response
  return follows.map(follow => {
    const profile = studentProfiles.find(p => p.userId.toString() === follow.followerId._id.toString());
    
    return {
      userId: follow.followerId._id,
      name: profile?.fullName || "Topper Student",
      profilePhoto: profile?.profilePhoto || null,
      class: profile?.class || null,
      joinedAt: follow.createdAt
    };
  });
};

exports.getMyProfile = async (userId) => {
  const profile = await TopperProfile.findOne({ userId }).lean();
  if (!profile) return null;

  // 📈 Calculate real-time stats
  const totalNotes = await Note.countDocuments({ topperId: userId });
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const advancedStats = await Order.aggregate([
    { $match: { topperId: new mongoose.Types.ObjectId(userId), paymentStatus: 'SUCCESS' } },
    {
      $facet: {
        total: [
          { $group: { _id: null, earnings: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
        ],
        thisMonth: [
          { $match: { topperId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, earnings: { $sum: '$amountPaid' } } }
        ],
        pending: [
          { $match: { topperId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: new Date(now - 2 * 24 * 60 * 60 * 1000) } } }, // Last 48h
          { $group: { _id: null, earnings: { $sum: '$amountPaid' } } }
        ]
      }
    }
  ]);

  const earnings = advancedStats[0]?.total[0]?.earnings || 0;
  const soldCount = advancedStats[0]?.total[0]?.count || 0;
  const thisMonthEarnings = advancedStats[0]?.thisMonth[0]?.earnings || 0;
  const pendingEarnings = advancedStats[0]?.pending[0]?.earnings || 0;

  console.log(`DEBUG: Stats for Topper ${userId} - Sold: ${soldCount}, Earnings: ${earnings}`);

  // Calculating Avg Rating from all published notes
  const notes = await Note.find({ topperId: userId, status: 'PUBLISHED' }).select('stats.ratingAvg stats.ratingCount');
  let totalRating = 0;
  let totalCount = 0;
  notes.forEach(n => {
    if (n.stats?.ratingCount > 0) {
      totalRating += (n.stats.ratingAvg * n.stats.ratingCount);
      totalCount += n.stats.ratingCount;
    }
  });
  const avgRating = totalCount > 0 ? (totalRating / totalCount).toFixed(1) : "0.0";

  return {
    ...profile,
    stats: {
      ...profile.stats,
      totalNotes,
      totalSold: soldCount,
      totalEarnings: earnings,
      thisMonthEarnings,
      pendingEarnings,
      rating: {
        average: parseFloat(avgRating),
        count: totalCount
      }
    }
  };
};

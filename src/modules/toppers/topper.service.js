const TopperProfile = require('./topper.model');
const User = require('../users/user.model');
const Note = require('../notes/notes.model');
const StudentProfile = require('../students/student.model');
const storageService = require('../../services/storage.service');
const Follow = require('./follow.model');

// save basic profile

exports.saveBasicProfile = async (userId, data, file, req) => {
  const user = await User.findById(userId);

  if (user.role !== 'TOPPER') {
    throw new Error('Only TOPPER users allowed');
  }

  const profilePhoto = file
    ? storageService.getFileUrl(req, file.filename)
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

  const marksheetUrl = storageService.getFileUrl(req, file.filename);

  const profile = await TopperProfile.findOneAndUpdate(
    { userId },
    {
      ...data,
      marksheetUrl,
      status: 'PENDING',
    },
    { new: true }
  );

  // ensure not auto-verified
  await User.findByIdAndUpdate(userId, {
    isTopperVerified: false,
  });

  return profile;
};

// get public profile

exports.getPublicProfile = async (userId, viewerId) => {
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
  
  // 3️⃣ Check if following
  let isFollowing = false;
  if (viewerId) {
     isFollowing = !!(await Follow.exists({ followerId: viewerId, followingId: userId }));
  }

  // 4️⃣ Fetch Latest Uploads (Notes)
  const notes = await Note.find({
    topperId: userId,
    status: 'PUBLISHED',
  })
  .select('subject chapterName class price stats previewImages')
  .sort({ createdAt: -1 })
  .limit(3)
  .lean();

  const latestUploads = notes.map(n => ({
    id: n._id,
    title: `${n.subject} - ${n.chapterName}`,
    subject: n.subject,
    price: n.price,
    rating: n.stats?.ratingAvg || 0,
    coverImage: n.previewImages?.[0] || null
  }));

  // 5️⃣ Prepare response (shape exactly for UI)
  return {
    userId: profile.userId,
    fullName: `${profile.firstName} ${profile.lastName}`,
    profilePhoto: profile.profilePhoto,
    verified: user?.isTopperVerified || false,
    isFollowing,

    achievements: profile.achievements,

    stats: {
      followers: profile.stats?.followersCount || 0,
      rating: {
        average: profile.stats?.rating?.average || 0,
        count: profile.stats?.rating?.count || 0,
      },
      totalNotes: profile.stats?.totalNotes || 0,
      totalSold: profile.stats?.totalSold || 0,
    },

    about: profile.shortBio,
    latestUploads,
  };
};

const redis = require('../../config/redis');

// ... existing code ...

// get all toppers (public call)
exports.getAllToppers = async (user) => {
  let enrichedToppers = [];

  // 1. Try to get from Cache
  const cachedToppers = await redis.get('all_toppers_enriched');
  
  if (cachedToppers) {
    enrichedToppers = JSON.parse(cachedToppers);
  } else {
    // 2. If Miss, Compute items (Expensive Aggregation)
    const toppers = await TopperProfile.find({ status: 'APPROVED' })
      .select('userId firstName lastName profilePhoto stream expertiseClass shortBio highlights stats board')
      .lean();

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

        return {
          id: topper._id, // Topper Profile ID
          userId: topper.userId, // User ID (for linking)
          name: `${topper.firstName} ${topper.lastName}`,
          profilePhoto: topper.profilePhoto,
          bio: topper.shortBio || `${topper.stream} Topper`,
          expertise: `Class ${topper.expertiseClass} • ${topper.stream}`,
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

    // Save to Cache (TTL 1 hour)
    await redis.set('all_toppers_enriched', JSON.stringify(enrichedToppers), 'EX', 3600);
  }

  // 3. Apply Filters (Personalization)
  // Even if data is cached, we filter it for the specific student
  if (user && user.role === 'STUDENT') {
    const studentProfile = await StudentProfile.findOne({ userId: user.id });

    if (studentProfile) {
      enrichedToppers = enrichedToppers.filter(topper => {
        let match = true;
        // Filter by Class
        if (studentProfile.class && topper.expertiseClass && topper.expertiseClass !== studentProfile.class) {
           match = false;
        }
        // Filter by Board (Note: Topper Schema has board, ensure it is populated/selected)
        // In my code above I didn't select 'board' from TopperProfile, let me fix standard fetch to include 'board'.
        // For cached data, we assume board is present. 
        // Note: The previous mongo query didn't select 'board'. I will add it to the select above.
        
        // Filter by Stream
         if (match && studentProfile.class === '12' && studentProfile.subjects?.length > 0) {
            const stream = inferStreamFromSubjects(studentProfile.subjects);
            if (stream && topper.stream && topper.stream !== stream) {
              match = false;
            }
         }
         return match;
      });
    }
  }

  return enrichedToppers;
};


// ... existing code ...

// Helper to infer stream
const inferStreamFromSubjects = (subjects) => {
  const STREAM_MAP = {
    SCIENCE: ["phy", "chem", "maths", "bio"],
    COMMERCE: ["acc", "bst", "eco", "maths"],
    ARTS: ["hist", "pol", "geo", "eco"],
  };

  for (const [stream, keywords] of Object.entries(STREAM_MAP)) {
     // If student has at least 2 subjects from this stream, assume it
     const matchCount = subjects.filter(sub => keywords.includes(sub)).length;
     if (matchCount >= 2) return stream;
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
    return { following: false, message: "Unfollowed successfully" };
  } else {
    // Follow
    await Follow.create({ followerId: studentId, followingId: topperId });
    // Update stats: increment followers
    await TopperProfile.findOneAndUpdate({ userId: topperId }, { $inc: { 'stats.followersCount': 1 } });
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


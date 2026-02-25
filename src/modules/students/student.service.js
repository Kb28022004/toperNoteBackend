const StudentProfile = require('./student.model');
const User = require('../users/user.model');
const storageService = require('../../services/storage.service');
const Order = require('../orders/order.model');
const Note = require('../notes/notes.model');
const TopperProfile = require('../toppers/topper.model');
const Follow = require('../toppers/follow.model');

exports.createStudent = async (userId, payload, file, req) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (user.role !== 'STUDENT') {
    const err = new Error('Only STUDENT users can create student profile');
    err.status = 403;
    throw err;
  }

  let profilePhoto;

  if (file) {
    profilePhoto = storageService.getFileUrl(req, `profiles/${file.filename}`);
  }

  const student = await StudentProfile.findOneAndUpdate(
    { userId },
    {
      userId,
      fullName: payload.fullName,
      class: payload.class,
      stream: payload.stream,
      board: payload.board,
      medium: payload.medium,
      subjects: payload.subjects,
      ...(profilePhoto && { profilePhoto }), 
    },
    { upsert: true, new: true }
  );

  user.profileCompleted = true;
  await user.save();

  return student;
};

exports.getStudentProfile = async (userId) => {
  const profile = await StudentProfile.findOne({ userId }).lean();
  
  if (!profile) return null;

  // 1. Fetch Stats
  const notesPurchasedCount = await Order.countDocuments({ studentId: userId, paymentStatus: 'SUCCESS' });
  const subjectsCoveredCount = profile.subjects?.length || 0;
  
  // 📚 Actual usage stats from session tracking
  const actualSeconds = profile.stats?.totalTimeSpent || 0;
  const hoursStudied = parseFloat((actualSeconds / 3600).toFixed(1));

  // 2. Fetch Recent Activity (Last 5 purchases)
  const recentOrders = await Order.find({ studentId: userId, paymentStatus: 'SUCCESS' })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const noteIds = recentOrders.map(o => o.noteId);
  const notes = await Note.find({ _id: { $in: noteIds } }).lean();

  const recentActivity = recentOrders.map(order => {
    const note = notes.find(n => n._id.toString() === order.noteId.toString());
    return {
      id: order._id,
      type: 'PURCHASE',
      title: note ? `${note.class}th ${note.subject} - ${note.chapterName}` : 'Note Purchase',
      date: order.createdAt,
      thumbnail: note?.previewImages?.[0] || null,
      isVerified: true
    };
  });

  return {
    ...profile,
    stats: {
      notesPurchased: notesPurchasedCount,
      hoursStudied: hoursStudied,
      subjectsCovered: subjectsCoveredCount
    },
    recentActivity
  };
};

/**
 * ==========================================
 * 🔍 GET PUBLIC STUDENT PROFILE (FOR TOPPERS)
 * ==========================================
 */
exports.getPublicStudentProfile = async (studentUserId) => {
  const profile = await StudentProfile.findOne({ userId: studentUserId }).lean();
  if (!profile) {
    throw new Error('Student profile not found');
  }

  // Fetch basic stats for the public view
  const notesPurchasedCount = await Order.countDocuments({ 
    studentId: studentUserId, 
    paymentStatus: 'SUCCESS' 
  });

  return {
    fullName: profile.fullName,
    class: profile.class,
    board: profile.board,
    stream: profile.stream,
    profilePhoto: profile.profilePhoto || null,
    subjects: profile.subjects || [],
    medium: profile.medium,
    stats: {
      notesPurchased: notesPurchasedCount,
      lastActive: profile.stats?.lastActiveAt
    }
  };
};

exports.getFollowedToppers = async (studentId, query = {}) => {
  const { search, expertiseClass, stream } = query;

  // 1. Get all following IDs for this student
  const follows = await Follow.find({ followerId: studentId }).lean();
  if (follows.length === 0) return [];

  const followingIds = follows.map((f) => f.followingId);

  // 2. Build filter for TopperProfile
  const filter = { userId: { $in: followingIds } };

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { shortBio: { $regex: search, $options: 'i' } },
    ];
  }

  if (expertiseClass) {
    filter.expertiseClass = expertiseClass;
  }

  if (stream) {
    filter.stream = stream;
  }

  const topperProfiles = await TopperProfile.find(filter)
    .select(
      'userId firstName lastName profilePhoto expertiseClass stream shortBio stats'
    )
    .sort({ createdAt: -1 })
    .lean();

  return topperProfiles.map((profile) => {
    const follow = follows.find(
      (f) => f.followingId.toString() === profile.userId.toString()
    );
    return {
      topperId: profile.userId,
      name: `${profile.firstName} ${profile.lastName}`,
      profilePhoto: profile.profilePhoto || null,
      expertise:
        profile.expertiseClass === '10'
          ? `Class 10 Topper`
          : `Class 12 • ${profile.stream || 'Topper'}`,
      class: profile.expertiseClass,
      stream: profile.stream,
      followedAt: follow?.createdAt,
    };
  });
};

exports.updateUsageStats = async (userId, { timeSpent }) => {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) throw new Error('Student profile not found');

  profile.stats.totalTimeSpent += parseInt(timeSpent || 0);
  profile.stats.lastActiveAt = new Date();
  
  await profile.save();
  return profile;
};

exports.updateProfilePicture = async (userId, file, req) => {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }

  let profilePhoto;
  if (file) {
    profilePhoto = storageService.getFileUrl(req, `profiles/${file.filename}`);
    profile.profilePhoto = profilePhoto;
    await profile.save();
  }

  return profile;
};

exports.updateAcademicProfile = async (userId, payload) => {
  const profile = await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: payload },
    { new: true }
  ).lean();

  if (!profile) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }

  return profile;
};

exports.deleteAccount = async (userId) => {
  // 1. Delete Student Profile
  await StudentProfile.findOneAndDelete({ userId });

  // 2. Delete User Account
  await User.findByIdAndDelete(userId);

  return { success: true };
};

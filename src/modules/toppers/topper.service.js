const TopperProfile = require('./topper.model');
const User = require('../users/user.model');
const storageService = require('../../services/storage.service');

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

exports.getPublicProfile = async (userId) => {
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

  // 3️⃣ Prepare response (shape exactly for UI)
  return {
    userId: profile.userId,
    fullName: `${profile.firstName} ${profile.lastName}`,
    profilePhoto: profile.profilePhoto,
    verified: user?.isTopperVerified || false,

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

    // Placeholder (next sprint)
    latestUploads: [], // will be filled from Notes module
  };
};

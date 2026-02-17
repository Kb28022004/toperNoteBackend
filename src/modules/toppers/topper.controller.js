const topperService = require('./topper.service');

// save basic profile

exports.saveBasicProfile = async (req, res, next) => {
  try {
    const result = await topperService.saveBasicProfile(
      req.user.id,
      req.body,
      req.file,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Topper profile saved',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// submit for verification

exports.submitForVerification = async (req, res, next) => {
  try {
    const result = await topperService.submitForVerification(
      req.user.id,
      req.body,
      req.file,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Submitted for admin verification',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


// get public profile

exports.getPublicProfile = async (req, res, next) => {
  try {
    const profile = await topperService.getPublicProfile(
      req.params.userId,
      req.user?.id
    );

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};// Get Followers
exports.getTopperFollowers = async (req, res, next) => {
  try {
    const followers = await topperService.getTopperFollowers(req.params.userId);
    res.json({
      success: true,
      data: followers
    });
  } catch (err) {
    next(err);
  }
};
// Follow Topper
exports.followTopper = async (req, res, next) => {
  try {
    // userId from auth token is the follower (student)
    // topperId from params is the one being followed
    const result = await topperService.followTopper(req.user.id, req.params.userId);
    res.json({
      success: true,
      message: result.message,
      data: { following: result.following }
    });
  } catch (err) {
    next(err);
  }
};
exports.getAllToppers = async (req, res, next) => {
  try {
    const toppers = await topperService.getAllToppers(req.user);
    res.json({
      success: true,
      data: toppers,
    });
  } catch (err) {
    next(err);
  }
};
exports.getMyProfile = async (req, res, next) => {
  try {
    const profile = await topperService.getMyProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

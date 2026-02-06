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
      req.params.userId
    );

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

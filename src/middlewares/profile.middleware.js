module.exports = (req, res, next) => {
  if (!req.user.profileCompleted) {
    return res.status(403).json({
      message: 'Please complete your profile to continue',
    });
  }
  next();
};

const studentService = require('./student.service');

exports.createStudent = async (req, res, next) => {
  try {
    const student = await studentService.createStudent(
      req.user.id,
      req.body,
      req.file,   
      req
    );

    res.status(201).json({
      success: true,
      message: 'Student profile setup successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await studentService.getStudentProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPublicProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const profile = await studentService.getPublicStudentProfile(studentId);
    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedToppers = async (req, res, next) => {
  try {
    const data = await studentService.getFollowedToppers(req.user.id, req.query);
    res.json({
      success: true,
      data: data,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStats = async (req, res, next) => {
  try {
    const { timeSpent } = req.body; // in seconds
    const data = await studentService.updateUsageStats(req.user.id, { timeSpent });
    res.json({
      success: true,
      message: 'Usage stats updated',
      data: data.stats,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfilePicture = async (req, res, next) => {
  try {
    const student = await studentService.updateProfilePicture(
      req.user.id,
      req.file,
      req
    );

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const student = await studentService.updateAcademicProfile(
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const result = await studentService.deleteAccount(req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
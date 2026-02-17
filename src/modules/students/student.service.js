const StudentProfile = require('./student.model');
const User = require('../users/user.model');
const storageService = require('../../services/storage.service');

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
  return await StudentProfile.findOne({ userId }).lean();
};

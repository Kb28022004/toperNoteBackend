const StudentProfile = require('./student.model');
const User = require('../users/user.model');
const storageService = require('../../services/storage.service');
const Order = require('../orders/order.model');
const Note = require('../notes/notes.model');

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
  
  // 📚 Note: "Hours Studied" is a placeholder since we don't have session tracking yet
  const hoursStudied = Math.floor(notesPurchasedCount * 4.5); 

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

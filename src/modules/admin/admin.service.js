const TopperProfile = require("../toppers/topper.model");
const User = require("../users/user.model");
const criteria = require("../../config/topperCriteria");
const Note = require('../notes/notes.model');

const avg = (arr) => arr.reduce((sum, s) => sum + s.marks, 0) / arr.length;

// Get all pending topper profiles

exports.getPendingToppers = async () => {
  return await TopperProfile.find({ status: "PENDING" }).populate(
    "userId",
    "phone",
  );
};

// Approve topper

exports.approveTopper = async (profileId) => {
  const profile = await TopperProfile.findById(profileId);

  if (!profile) throw new Error("Topper profile not found");

  const { expertiseClass, stream, subjectMarks } = profile;

  // 🔹 CLASS 10 LOGIC
  if (expertiseClass === "10") {
    if (subjectMarks.length < criteria.CLASS_10.REQUIRED_SUBJECTS) {
      throw new Error("Class 10 must have 5 subjects");
    }

    const low = subjectMarks.find(
      (s) => s.marks < criteria.CLASS_10.MIN_SUBJECT_PERCENT,
    );
    if (low) {
      throw new Error(`Low marks in ${low.subject}`);
    }

    if (avg(subjectMarks) < criteria.CLASS_10.MIN_AVERAGE_PERCENT) {
      throw new Error("Average below Class 10 topper criteria");
    }
  }

  // 🔹 CLASS 12 LOGIC
  if (expertiseClass === "12") {
    const streamCriteria = criteria.CLASS_12[stream];

    if (!streamCriteria) {
      throw new Error("Invalid stream for Class 12");
    }

    // check required subjects exist
    for (const core of streamCriteria.REQUIRED_SUBJECTS) {
      const subject = subjectMarks.find((s) => s.subject === core);
      if (!subject) {
        throw new Error(`Missing core subject: ${core}`);
      }
      if (subject.marks < streamCriteria.MIN_SUBJECT_PERCENT) {
        throw new Error(`${core} marks below criteria`);
      }
    }

    if (avg(subjectMarks) < streamCriteria.MIN_AVERAGE_PERCENT) {
      throw new Error("Average below topper criteria");
    }
  }

  // ✅ APPROVE
  profile.status = "APPROVED";
  await profile.save();

  await User.findByIdAndUpdate(profile.userId, {
    isTopperVerified: true,
  });

  return "Topper approved based on academic criteria";
};

// Reject topper

exports.rejectTopper = async (profileId, reason) => {
  const profile = await TopperProfile.findById(profileId);

  if (!profile) throw new Error("Topper profile not found");

  profile.status = "REJECTED";
  profile.adminRemark = reason || "Does not meet topper criteria";
  await profile.save();

  await User.findByIdAndUpdate(profile.userId, {
    isTopperVerified: false,
  });

  return "Topper rejected";
};


// 1️⃣ Get all notes under review
exports.getPendingNotes = async () => {
  return await Note.find({ status: 'UNDER_REVIEW' })
    .populate({
      path: 'topperId',
      select: '_id',
    })
    .sort({ createdAt: -1 })
    .lean();
};

// 2️⃣ Approve note
exports.approveNote = async (noteId) => {
  const note = await Note.findById(noteId);

  if (!note) {
    throw new Error('Note not found');
  }

  if (note.status !== 'UNDER_REVIEW') {
    throw new Error('Note is not pending review');
  }

  note.status = 'PUBLISHED';
  note.adminRemark = null;
  await note.save();

  // 🔄 Increment topper stats
  await TopperProfile.updateOne(
    { userId: note.topperId },
    { $inc: { 'stats.totalNotes': 1 } }
  );

  return 'Note approved and published';
};

// 3️⃣ Reject note
exports.rejectNote = async (noteId, reason) => {
  const note = await Note.findById(noteId);

  if (!note) {
    throw new Error('Note not found');
  }

  if (note.status !== 'UNDER_REVIEW') {
    throw new Error('Note is not pending review');
  }

  note.status = 'REJECTED';
  note.adminRemark = reason || 'Rejected by admin';
  await note.save();

  return 'Note rejected';
};

// preview note (admin only)
exports.previewNote = async (noteId) => {
  const note = await Note.findById(noteId);

  if (!note) {
    throw new Error('Note not found');
  }

  return {
    title: note.title,
    description: note.description,
    previewImages: note.previewImages,
    pageCount: note.pageCount,
  };
}

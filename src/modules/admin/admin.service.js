const TopperProfile = require("../toppers/topper.model");
const AdminProfile = require("./admin.model");
const User = require("../users/user.model");
const storageService = require('../../services/storage.service');
const criteria = require("../../config/topperCriteria");
const Note = require('../notes/notes.model');
const redis = require("../../config/redis");

const avg = (arr) => arr.reduce((sum, s) => sum + s.marks, 0) / arr.length;

const transformUrls = (item, req) => {
  if (!req) return item;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  if (item.marksheetUrl && item.marksheetUrl.indexOf("/uploads/") !== -1) {
    let pathAfterUploads = item.marksheetUrl.split("/uploads/")[1];
    if (!pathAfterUploads.startsWith("marksheets/")) {
      pathAfterUploads = "marksheets/" + pathAfterUploads;
    }
    item.marksheetUrl = `${baseUrl}/uploads/${pathAfterUploads}`;
  }

  if (item.profilePhoto && item.profilePhoto.indexOf("/uploads/") !== -1) {
    let pathAfterUploads = item.profilePhoto.split("/uploads/")[1];
    if (!pathAfterUploads.startsWith("profiles/")) {
      pathAfterUploads = "profiles/" + pathAfterUploads;
    }
    item.profilePhoto = `${baseUrl}/uploads/${pathAfterUploads}`;
  }
  return item;
};

// Create/Update Admin Profile
exports.createProfile = async (userId, payload, file, req) => {
    let profilePhoto;
    if (file) {
        profilePhoto = storageService.getFileUrl(req, `profiles/${file.filename}`);
    }

    const profile = await AdminProfile.findOneAndUpdate(
        { userId },
        {
            userId,
            fullName: payload.fullName,
            bio: payload.bio,
            department: payload.department,
            designation: payload.designation,
            ...(profilePhoto && { profilePhoto })
        },
        { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    return profile;
};

// Get all pending topper profiles
exports.getToppers = async ({
  page = 1,
  limit = 10,
  search = "",
  expertiseClass,
  stream,
  board,
  status = "PENDING",
  req
}) => {
  // 1. Try Cache if it's a standard first page request without specific filters
  const isCacheable = page === 1 && !search && !expertiseClass && !stream && !board;
  const cacheKey = `admin:toppers:${status}`;

  if (isCacheable) {
    try {
        if (redis.status === 'ready') {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                // We still need to transform URLs because host might change (e.g. dev environment)
                parsed.data = parsed.data.map(item => transformUrls(item, req));
                return parsed;
            }
        }
    } catch (err) {
        console.error("Redis Cache Error (Get Toppers):", err.message);
    }
  }

  // Optimization: Check if any requests exist at all for this status
  const hasData = await TopperProfile.exists({ status });
  if (!hasData) {
    return {
      data: [],
      pagination: {
        total: 0,
        page,
        pages: 0,
        limit,
      },
    };
  }

  const matchStage = { status };

  if (expertiseClass) matchStage.expertiseClass = expertiseClass;
  if (stream) matchStage.stream = stream;
  if (board) matchStage.board = board;

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    {
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(search, "i");
    pipeline.push({
      $match: {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { "userDetails.phone": searchRegex },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            expertiseClass: 1,
            stream: 1,
            board: 1,
            subjectMarks: 1,
            marksheetUrl: 1,
            userId: {
              _id: "$userDetails._id",
              phone: "$userDetails.phone",
            },
            status: 1,
            createdAt: 1,
          },
        },
      ],
    },
  });

  const [result] = await TopperProfile.aggregate(pipeline);
  
  // Transform URLs to match current host
  const data = result.data.map((item) => transformUrls(item, req));

  const total = result.metadata[0] ? result.metadata[0].total : 0;

  const finalResult = {
    data,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    },
  };

  // Cache fixed standard requests for 5 minutes
  if (isCacheable) {
    try {
        if (redis.status === 'ready') {
            await redis.set(cacheKey, JSON.stringify(finalResult), 'EX', 300);
        }
    } catch (err) {
        console.error("Redis Cache Error (Set Toppers):", err.message);
    }
  }

  return finalResult;
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

  // 🧹 Invalidate Caches
  try {
    if (redis.status === 'ready') {
        await redis.del(`admin:toppers:PENDING`);
        await redis.del(`admin:toppers:APPROVED`);
        await redis.del('all_toppers_enriched'); // Public cache
    }
  } catch (err) {
    console.error("Redis Cache Error (Approve Topper):", err.message);
  }

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

  // 🧹 Invalidate Caches
  try {
    if (redis.status === 'ready') {
        await redis.del(`admin:toppers:PENDING`);
        await redis.del(`admin:toppers:REJECTED`);
    }
  } catch (err) {
    console.error("Redis Cache Error (Reject Topper):", err.message);
  }

  return "Topper rejected";
};


// 1️⃣ Get notes by status
exports.getNotesByStatus = async (status = 'UNDER_REVIEW') => {
  const cacheKey = `admin:notes:${status.toLowerCase()}`;
  
  try {
    if (redis.status === 'ready') {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Redis Cache Error (Get Notes By Status):", err.message);
  }

  const notes = await Note.aggregate([
    { $match: { status } },
    {
      $lookup: {
        from: 'topperprofiles',
        localField: 'topperId',
        foreignField: 'userId',
        as: 'topperProfile'
      }
    },
    {
      $unwind: {
        path: '$topperProfile',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        subject: 1,
        class: 1,
        chapterName: 1,
        board: 1,
        price: 1,
        status: 1,
        createdAt: 1,
        topperId: {
          _id: '$topperId',
          firstName: '$topperProfile.firstName',
          lastName: '$topperProfile.lastName'
        }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);

  try {
    if (redis.status === 'ready') {
        await redis.set(cacheKey, JSON.stringify(notes), 'EX', 300);
    }
  } catch (err) {
    console.error("Redis Cache Error (Set Notes By Status):", err.message);
  }
  
  return notes;
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

  // 🧹 Invalidate Cache
  try {
    if (redis.status === 'ready') {
        // We need to invalidate the specific status key we are fetching from
        // Assuming 'UNDER_REVIEW' is the default status for pending notes list
        await redis.del('admin:notes:under_review'); 
        await redis.del('all_toppers_enriched');
    }
  } catch (err) {
    console.error("Redis Cache Error (Approve Note):", err.message);
  }

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

  // 🧹 Invalidate Cache
  try {
    if (redis.status === 'ready') {
        // We need to invalidate the specific status key we are fetching from
        await redis.del('admin:notes:under_review');
    }
  } catch (err) {
    console.error("Redis Cache Error (Reject Note):", err.message);
  }

  return 'Note rejected';
};

// preview note (admin only)
exports.getNotePreview = async (user, noteId) => {
  const note = await Note.findById(noteId);

  if (!note) {
    throw new Error('Note not found');
  }

  return {
    title: note.title,
    chapterName: note.chapterName,
    subject: note.subject,
    class: note.class,
    board: note.board,
    price: note.price,
    description: note.description,
    previewImages: note.previewImages,
    pdfUrl: note.pdfUrl,
    pageCount: note.pageCount,
  };
}

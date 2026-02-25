const mongoose = require('mongoose');
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const Note = require("./notes.model");
const TopperProfile = require("../toppers/topper.model");
const Order = require("../orders/order.model");
const StudentProfile = require("../students/student.model");
const Review = require("../reviews/review.model");
const Follow = require("../toppers/follow.model");

const storageService = require("../../services/storage.service");
const { convertPdfToImages } = require("../../utils/pdfToImages");
const redis = require("../../config/redis");

const STREAM_SUBJECTS = {
  SCIENCE: ["Physics", "Chemistry", "Maths", "Biology"],
  COMMERCE: ["Accountancy", "Business Studies", "Economics", "Maths"],
  ARTS: ["History", "Political Science", "Geography", "Economics"],
};

/**
 * ===============================
 * 📤 UPLOAD NOTE (TOPPER)
 * ===============================
 */
exports.uploadNote = async (userId, data, files, req) => {
  // 1️⃣ Ensure verified topper
  const topper = await TopperProfile.findOne({
    userId,
    status: "APPROVED",
  });

  if (!topper) {
    throw new Error("Only verified toppers can upload notes");
  }

  // 2️⃣ Subject validation (Class 12 stream rule)
  if (topper.expertiseClass === "12") {
    const allowedSubjects = STREAM_SUBJECTS[topper.stream] || [];
    if (!allowedSubjects.includes(data.subject)) {
      throw new Error(
        `You are allowed to upload notes only for: ${allowedSubjects.join(", ")}`
      );
    }
  }

  // 3️⃣ PDF required
  if (!files?.pdf?.[0]) {
    throw new Error("PDF file is required");
  }

  const pdfFile = files.pdf[0];
  const pdfPath = pdfFile.path;

  if (!fs.existsSync(pdfPath)) {
    throw new Error("Uploaded PDF file not found");
  }

  // 4️⃣ Parse PDF & count pages (SOURCE OF TRUTH)
// 4️⃣ Parse PDF & count pages
let pageCount;

try {
  if (pdfFile.mimetype !== "application/pdf") {
    throw new Error("Not a PDF file");
  }

  if (!fs.existsSync(pdfFile.path)) {
    throw new Error("PDF not saved on disk");
  }

  const stats = fs.statSync(pdfFile.path);
  if (stats.size === 0) {
    throw new Error("PDF file is empty");
  }

  const pdfBuffer = fs.readFileSync(pdfFile.path);
  const pdfData = await pdfParse(pdfBuffer);

  if (!pdfData?.numpages) {
    throw new Error("PDF pages not detected");
  }

  pageCount = pdfData.numpages;

} catch (err) {
  console.error("PDF PARSE ERROR:", err.message);
  throw new Error("Uploaded file is not a valid or readable PDF");
}


  if (!pageCount || pageCount < 5) {
    throw new Error("Invalid PDF file: Note must have at least 5 pages");
  }

  // 5️⃣ PREVIEW IMAGES LOGIC
  // Priority: 1. Try generating from PDF
  //           2. Use manually uploaded previews
  
  const previewDir = path.join("uploads", "previews");
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const baseName = `note-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  let generatedFiles = [];
  let previewImages = [];

  // attempt generation
  try {
    generatedFiles = await convertPdfToImages(pdfPath, previewDir, baseName);
    
    if (generatedFiles && generatedFiles.length > 0) {
       previewImages = generatedFiles
        .sort()
        .map((file) => storageService.getFileUrl(req, `previews/${file}`));
    }
  } catch (err) {
    console.warn("⚠️ Preview generation failed:", err.message);
    // don't throw, we have fallback
  }

  // (Fallback logic removed: Strictly generating from PDF)

  // validation: must have at least one preview source
  if (previewImages.length === 0) {
      console.warn("⚠️ Preview generation yielded 0 images. Admin will see 0 pages. Check pdf-poppler installation.");
      // We allow upload to proceed. Admin can view via PDF URL.
      previewImages = []; 
  }


  // Parse tableOfContents if it's a string
  let tableOfContents = data.tableOfContents;
  if (typeof tableOfContents === 'string') {
    try {
      tableOfContents = JSON.parse(tableOfContents);
    } catch (e) {
      console.error("Error parsing tableOfContents:", e);
      tableOfContents = [];
    }
  }

  // 7️⃣ Save note
  const note = await Note.create({
    topperId: userId,

    subject: data.subject,
    chapterName: data.chapterName,
    class: data.class,
    board: data.board,
    price: data.price,
    tags: data.tags || [],
    description: data.description || '',
    tableOfContents: tableOfContents || [],

    pdfUrl: storageService.getFileUrl(req, `pdfs/${pdfFile.filename}`),
    pageCount,                // ✅ real count
    previewImages,            // ✅ all pages
    publicPreviewCount: Math.max(1, Math.ceil(pageCount / 4)),    // students see 1/4th of pages (min 1)

    status: "UNDER_REVIEW",
  });

  return note;
};
/**
 * ===============================
 * 📋 GET ALL NOTES FOR APPROVAL (ADMIN)
 * ===============================
 */
exports.getPendingNotes = async () => {
    return await Note.find({ status: "UNDER_REVIEW" })
        .populate({
            path: "topperId",
            select: "fullName email profilePhoto stream" // Select relevant topper fields
        })
        .sort({ createdAt: -1 }) // Newest first
        .lean();
};

/**
 * ===============================
 * 📚 GET ALL APPROVED NOTES (STUDENTS)
 * ===============================
 */
exports.getAllApprovedNotes = async (user, filters = {}) => {
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.max(1, parseInt(filters.limit) || 10);
    const skip = (page - 1) * limit;

    // 1. Build cache key (personalized per user, or shared for guests)
    const userId = user?.id || 'guest';
    const cacheKey = `notes:marketplace:${userId}:${filters.subject || 'all'}:${filters.class || 'all'}:${filters.board || 'all'}:${filters.topperId || 'all'}:${filters.tags || 'none'}:${filters.search || 'none'}:${filters.sortBy || 'newest'}:${filters.timeRange || 'all'}:${page}`;
    const cacheTTL = userId === 'guest' ? 600 : 60; // guests: 10 min, students: 60 sec

    // 2. Try Redis cache
    try {
        if (redis.status === 'ready') {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);
        }
    } catch (err) {
        console.error("Redis Cache Error (Get):", err.message);
    }

    const query = { status: "PUBLISHED" };

    // Standard Filters
    if (filters.subject) query.subject = filters.subject;
    if (filters.class) query.class = filters.class;
    if (filters.board) query.board = filters.board;
    if (filters.topperId) query.topperId = filters.topperId;
    
    // Time Range Filter — using ObjectId timestamp (works for ALL existing docs, even without createdAt)
    if (filters.timeRange && filters.timeRange !== 'all') {
        let dateLimit;

        if (filters.timeRange === '24h') {
            dateLimit = new Date(Date.now() - (24 * 60 * 60 * 1000));
        } else if (filters.timeRange === '7d') {
            dateLimit = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        } else if (filters.timeRange === '1m') {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            dateLimit = d;
        }

        if (dateLimit) {
            // Convert date to ObjectId — works even on documents without a createdAt field
            const minId = mongoose.Types.ObjectId.createFromTime(Math.floor(dateLimit.getTime() / 1000));
            query._id = { $gte: minId };
        }
    }

    // 3. Search & Tags
    if (filters.tags) {
        query.tags = { $in: Array.isArray(filters.tags) ? filters.tags : [filters.tags] };
    }

    if (filters.search) {
        const searchRegex = { $regex: filters.search, $options: "i" };
        query.$or = [
            { chapterName: searchRegex },
            { subject: searchRegex }
        ];
    }

    // 4. Sorting logic
    let sortOptions = { createdAt: -1 }; // Default: Newest
    if (filters.sortBy === 'price_low') {
        sortOptions = { price: 1 };
    } else if (filters.sortBy === 'price_high') {
        sortOptions = { price: -1 };
    } else if (filters.sortBy === 'rating') {
        sortOptions = { 'stats.ratingAvg': -1 };
    }

    // 5. Pagination & Execution
    const totalNotes = await Note.countDocuments(query);
    let notes = await Note.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

    // 5. Manual Population of Topper Profile
    // Note: topperId in Note refs to User. We need TopperProfile details.
    const topperUserIds = notes.map(n => n.topperId);
    
    // Fetch profiles for these users
    const topperProfiles = await TopperProfile.find({ 
        userId: { $in: topperUserIds } 
    }).select('userId firstName lastName profilePhoto stream status expertiseClass highlights').lean();

    // 6. Check for purchases if user is logged in
    let purchasedNoteIds = [];
    if (user && user.id) {
        const orders = await Order.find({ 
            studentId: user.id, 
            paymentStatus: "SUCCESS" 
        }).select('noteId').lean();
        purchasedNoteIds = orders.map(o => o.noteId.toString());
    }

    // 7. Check for favorite notes if user is logged in
    let favoriteNoteIds = [];
    if (user && user.id && user.role === 'STUDENT') {
        const student = await StudentProfile.findOne({ userId: user.id }).select('savedNotes').lean();
        if (student && student.savedNotes) {
            favoriteNoteIds = student.savedNotes.map(id => id.toString());
        }
    }

    // Map profiles to notes
    const mappedNotes = notes.map(note => {
        // Find matching profile
        const profile = topperProfiles.find(p => p.userId.toString() === note.topperId.toString());
        
        // Enrich topperId field with profile data
        note.topperId = profile ? {
            _id: profile.userId, // Maintain consistency with frontend expectation of ID presence
            firstName: profile.firstName,
            lastName: profile.lastName,
            fullName: `${profile.firstName} ${profile.lastName}`,
            profilePhoto: profile.profilePhoto,
            stream: profile.stream,
            status: profile.status, // e.g. APPROVED
            isVerified: profile.status === 'APPROVED',
            expertiseClass: profile.expertiseClass
        } : {
            _id: note.topperId,
            fullName: "Topper",
            isVerified: false
        };

        const quarterPages = Math.max(1, Math.ceil(note.pageCount / 4));
        note.previewImages = note.previewImages ? note.previewImages.slice(0, quarterPages) : [];
        
        // Add calculated fields for UI
        note.rating = note.stats?.ratingAvg ? note.stats.ratingAvg.toFixed(1) : (4 + Math.random()).toFixed(1); // Fake for now if 0
        note.thumbnail = note.previewImages[0] || null;
        note.isPurchased = purchasedNoteIds.includes(note._id.toString());
        note.isFavorite = favoriteNoteIds.includes(note._id.toString());
        
        return note;
    });

    const result = {
        notes: mappedNotes,
        pagination: {
            totalNotes,
            totalPages: Math.ceil(totalNotes / limit),
            currentPage: page,
            limit
        }
    };

    // 💾 Cache the result
    try {
        if (redis.status === 'ready') {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', cacheTTL);
        }
    } catch (err) {
        console.error("Redis Cache Error (Set):", err.message);
    }

    return result;
};

/**
 * ===============================
 * 🛡️ APPROVE/REJECT NOTE (ADMIN)
 * ===============================
 */
exports.updateNoteStatus = async (noteId, status, adminRemark) => {
    const note = await Note.findById(noteId);
    if (!note) throw new Error("Note not found");

    note.status = status;
    if (adminRemark) note.adminRemark = adminRemark;

    return await note.save();
};

/**
 * ===============================
 * 👀 GET NOTE PREVIEW
 * ===============================
 */
exports.getNotePreview = async (user, noteId) => {
  const note = await Note.findById(noteId).lean();
  if (!note) throw new Error("Note not found");

  // 🔐 Admin → ALL pages
  if (user?.role === "ADMIN") {
    return {
      pages: note.previewImages,
      totalPages: note.pageCount,
      pdfUrl: note.pdfUrl // ✅ Admin needs full PDF access to review
    };
  }

  // 🔐 Student → check purchase
  const hasPurchased = user
    ? await Order.exists({
        noteId,
        studentId: user.id,
        paymentStatus: "SUCCESS",
      })
    : false;

  if (hasPurchased) {
    return {
      fullPdf: true,
    };
  }

  // 👀 Public preview (1/4th of pages, min 1)
  const quarterPages = Math.max(1, Math.ceil(note.pageCount / 4));
  return {
    pages: note.previewImages.slice(0, quarterPages),
    totalPages: note.pageCount,
  };
};



/**
* ===============================
* 📅 Helper: Format "days ago"
* ===============================
*/
const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
  
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

/**
 * ===============================
 * 📝 GET NOTE DETAILS (STUDENT PANEL)
 * ===============================
 */
exports.getNoteDetails = async (noteId, userId, userRole) => {
    const cacheKey = `note:details:v6:${noteId}`;
    let noteData;

    try {
        if (redis.status === 'ready') {
            const cached = await redis.get(cacheKey);
            if (cached) {
                noteData = JSON.parse(cached);
            }
        }
    } catch (err) {
        console.error("Redis Cache Error (Get Note):", err.message);
    }
    
    // Fetch if not in cache OR if cache is missing critical rawPdfUrl field
    if (!noteData || !noteData.rawPdfUrl) {
        // 1. Fetch Note + Topper
        const note = await Note.findOne({ _id: new mongoose.Types.ObjectId(noteId) })
            .populate("topperId", "firstName lastName profilePhoto stream highlights isVerified");
        
        if (!note) throw new Error("Note not found");

        // Safety check: Non-owners can only see PUBLISHED notes
        if (note.status !== 'PUBLISHED' && note.topperId._id.toString() !== userId) {
            throw new Error("This note is not yet available for viewing");
        }

        // 2. Fetch Topper Profile for extra metadata
        const topperProfile = await TopperProfile.findOne({ userId: note.topperId._id }).lean();

        // 5. Fetch Real Reviews
        const reviews = await Review.find({ noteId: new mongoose.Types.ObjectId(noteId) })
            .populate({
                path: 'studentId',
                select: 'fullName profilePhoto userId'
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const formattedReviews = reviews.map(r => ({
            studentId: r.studentId?.userId, // This is the User ID
            user: r.studentId?.fullName || "Student",
            daysAgo: formatTimeAgo(r.createdAt),
            rating: r.rating,
            comment: r.comment,
            verifiedPurchase: r.isVerifiedPurchase
        }));

        noteData = {
            id: note._id,
            title: `Class ${note.class} ${note.subject} - ${note.chapterName}`,
            subject: note.subject,
            class: note.class,
            board: note.board,
            previewImages: note.previewImages || [],
            pageCount: note.pageCount || 0,
            rating: parseFloat((note.stats?.ratingAvg || 0).toFixed(1)),
            reviewCount: note.stats?.ratingCount || 0,
            price: note.price,
            topper: {
                id: note.topperId._id,
                name: topperProfile ? `${topperProfile.firstName} ${topperProfile.lastName}` : "Topper",
                profilePhoto: topperProfile?.profilePhoto || note.topperId.profilePhoto,
                badges: topperProfile?.isVerified ? ["VERIFIED TOPPER"] : ["TOPPER"],
                bio: topperProfile?.shortBio || topperProfile?.highlights?.[0] || "Topper at ToppersNote",
                isVerified: topperProfile?.status === 'APPROVED'
            },
            description: note.description || "No description provided for these notes.",
            language: note.language || "English",
            pdfSize: note.pdfSize || null,
            tableOfContents: note.tableOfContents || [],
            reviews: formattedReviews,
            rawPdfUrl: note.pdfUrl
        };

        try {
            if (redis.status === 'ready') {
                await redis.set(cacheKey, JSON.stringify(noteData), 'EX', 1800); // 30 mins
            }
        } catch (err) {
            console.error("Redis Cache Error (Set Note):", err.message);
        }
    }

    // 3. Purchase Status - Always Dynamic
    let isPurchased = false;
    if (userId) {
        isPurchased = await Order.exists({
            noteId,
            studentId: userId,
            paymentStatus: "SUCCESS"
        });
    }

    // 4. Previews Logic (Admin/Topper see all, Student sees 3 pages if not purchased)
    let finalPreviews = noteData.previewImages;
    const isViewerStudent = userRole === 'STUDENT';

    // If viewer is a student and hasn't purchased, limit to 30% of total pages
    if (isViewerStudent && !isPurchased && finalPreviews.length > 0) {
        const previewLimit = Math.max(1, Math.ceil(noteData.pageCount * 0.3)); // 30% logic
        finalPreviews = finalPreviews.slice(0, Math.min(previewLimit, finalPreviews.length));
    }
    
    // 6. Check Following Status & Sales Count
    let isFollowing = false;
    let salesCount = 0;
    
    const [followExists, currentSales, savedExists] = await Promise.all([
        userId ? Follow.exists({ followerId: userId, followingId: noteData.topper.id }) : Promise.resolve(false),
        Order.countDocuments({ noteId, paymentStatus: 'SUCCESS' }),
        userId ? StudentProfile.exists({ userId, savedNotes: noteId }) : Promise.resolve(false)
    ]);

    isFollowing = !!followExists;
    salesCount = currentSales;
    const isFavorite = !!savedExists;

    return {
        ...noteData,
        previewImages: finalPreviews,
        isPurchased: !!isPurchased,
        isFollowing,
        isFavorite,
        salesCount, 
        pdfUrl: isPurchased ? noteData.rawPdfUrl : null,
        price: {
            current: noteData.price,
            original: Math.round(noteData.price * 1.5),
            discount: "33% OFF"
        }
    };
};

/**
 * ===============================
 * 👥 GET NOTE BUYERS (TOPPER)
 * ===============================
 */
exports.getNoteBuyers = async (topperId, noteId) => {
  // 1️⃣ Verify ownership
  const note = await Note.findOne({
    _id: noteId,
    topperId,
  });

  if (!note) {
    throw new Error("You are not authorized to view buyers of this note");
  }

  // 2️⃣ Fetch successful orders
  const orders = await Order.find({
    noteId,
    paymentStatus: "SUCCESS",
  })
    .populate({
      path: "studentId",
      select: "_id",
    })
    .lean();

  if (!orders.length) return [];

  // Filter out any orders where studentId might be null (e.g. deleted user)
  const validOrders = orders.filter(o => o.studentId && o.studentId._id);

  // 3️⃣ Fetch student profiles
  const studentIds = validOrders.map((o) => o.studentId._id);

  const students = await StudentProfile.find({
    userId: { $in: studentIds },
  })
    .select("userId fullName class board profilePhoto")
    .lean();

  // 4️⃣ Map response
  return validOrders.map((order) => {
    const profile = students.find(
      (s) => s.userId?.toString() === order.studentId._id.toString()
    );

    return {
      studentId: order.studentId._id,
      studentName: profile?.fullName || "Student",
      class: profile?.class,
      board: profile?.board,
      profilePhoto: profile?.profilePhoto || null,
      purchasedAt: order.createdAt,
    };
  });
};

/**
 * ===============================
 * ❤️ TOGGLE FAVORITE NOTE (STUDENT)
 * ===============================
 */
exports.toggleFavoriteNote = async (userId, noteId) => {
    // 1. Find profile
    const profile = await StudentProfile.findOne({ userId });
    if (!profile) throw new Error("Student profile not found");

    // 2. Check if already favorited
    const noteIndex = profile.savedNotes.indexOf(noteId);
    let isFavorite = false;

    if (noteIndex > -1) {
        // Unfavorite
        profile.savedNotes.splice(noteIndex, 1);
        isFavorite = false;
    } else {
        // Favorite
        profile.savedNotes.push(noteId);
        isFavorite = true;
    }

    await profile.save();
    return { isFavorite, message: isFavorite ? "Note added to favorites" : "Note removed from favorites" };
};

/**
 * ===============================
 * ⭐ GET FAVORITE NOTES (STUDENT)
 * ===============================
 */
exports.getFavoriteNotes = async (userId, options = {}) => {
    const { page = 1, limit = 10, search = '' } = options;
    const skip = (page - 1) * limit;

    const profile = await StudentProfile.findOne({ userId }).populate({
        path: 'savedNotes',
        match: search ? {
            $or: [
                { chapterName: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ]
        } : {}
    });

    if (!profile) throw new Error("Student profile not found");

    const total = profile.savedNotes.length;
    // Client side pagination because populate match doesn't support pagination easily on subdocs
    const paginatedNotes = profile.savedNotes.slice(skip, skip + limit);

    // Enrich with topper info
    const enrichedNotes = await Promise.all(paginatedNotes.map(async (note) => {
        const topper = await TopperProfile.findOne({ userId: note.topperId }).select('firstName lastName profilePhoto stream').lean();
        return {
            _id: note._id,
            title: note.chapterName,
            subject: note.subject,
            class: note.class,
            topperName: topper ? `${topper.firstName} ${topper.lastName}` : "Topper",
            profilePhoto: topper?.profilePhoto || null,
            thumbnail: note.previewImages?.[0] || null,
            pageCount: note.pageCount || 0,
            price: note.price
        };
    }));

    return {
        notes: enrichedNotes,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
    };
};

exports.getMyNotes = async (userId, options = {}) => {
  const { search = '', status, sortBy = 'newest', page = 1, limit = 10 } = options;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build filter
  const filter = { topperId: userId };
  if (status && status !== 'all') filter.status = status.toUpperCase();
  if (search) {
    filter.$or = [
      { chapterName: { $regex: search, $options: 'i' } },
      { subject:     { $regex: search, $options: 'i' } },
    ];
  }
  // Only show notes with at least 1 successful sale
  if (options.sold === 'true') {
    const soldNoteIds = await Order.distinct('noteId', {
      topperId: userId,
      paymentStatus: 'SUCCESS',
    });
    filter._id = { $in: soldNoteIds };
  }


  // Sort
  let sortOptions = { createdAt: -1 };
  if (sortBy === 'oldest')      sortOptions = { createdAt:  1 };
  else if (sortBy === 'price_low')  sortOptions = { price: 1 };
  else if (sortBy === 'price_high') sortOptions = { price: -1 };
  else if (sortBy === 'sales')      sortOptions = { salesCount: -1 };

  const totalNotes = await Note.countDocuments(filter);
  const notes      = await Note.find(filter)
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Enrich with sales count
  const enrichedNotes = await Promise.all(notes.map(async (note) => {
    const salesCount = await Order.countDocuments({ noteId: note._id, paymentStatus: 'SUCCESS' });
    return { ...note, salesCount };
  }));

  return {
    notes: enrichedNotes,
    pagination: {
      totalNotes,
      totalPages: Math.ceil(totalNotes / parseInt(limit)),
      currentPage: parseInt(page),
      limit: parseInt(limit),
    },
  };
};

/**
 * ===============================
 * 🛍️ GET PURCHASED NOTES (STUDENT)
 * ===============================
 */
exports.getPurchasedNotes = async (userId, options = {}) => {
  const { search = '', page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;


  // 1. Fetch ALL successful orders for this student to get noteIds
  // (We need the list of allowed notes before we can filter them by search)
  const allOrders = await Order.find({ studentId: userId, paymentStatus: 'SUCCESS' }).lean();
  
  if (!allOrders.length) return { notes: [], total: 0, page, totalPages: 0 };

  const noteIds = allOrders.map(o => o.noteId);

  // 2. Build Note Filter
  const noteFilter = { _id: { $in: noteIds } };
  if (search) {
    noteFilter.$or = [
      { chapterName: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }

  // 3. Fetch Notes with Pagination
  const totalNotes = await Note.countDocuments(noteFilter);
  const notes = await Note.find(noteFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  if (!notes.length) return { notes: [], total: totalNotes, page, totalPages: Math.ceil(totalNotes / limit) };

  // 4. Fetch Topper Profiles for these specific notes
  const topperIds = notes.map(n => n.topperId);
  const topperProfiles = await TopperProfile.find({ userId: { $in: topperIds } })
    .select('userId firstName lastName profilePhoto')
    .lean();

  // 5. Map and Enrich
  const enrichedNotes = notes.map(note => {
    const profile = topperProfiles.find(p => p.userId.toString() === note.topperId.toString());
    const order = allOrders.find(o => o.noteId.toString() === note._id.toString());
    
    return {
      _id: note._id,
      title: note.chapterName,
      subject: note.subject,
      class: note.class,
      topperName: profile ? `${profile.firstName} ${profile.lastName}` : "Topper",
      profilePhoto: profile?.profilePhoto || null,
      thumbnail: note.previewImages?.[0] || null,
      purchasedAt: order?.createdAt,
      pageCount: note.pageCount || 0,
      pdfUrl: note.pdfUrl
    };
  });

  return {
    notes: enrichedNotes,
    total: totalNotes,
    page: parseInt(page),
    totalPages: Math.ceil(totalNotes / limit)
  };
};

/**
 * getMySalesDetails — returns a topper's complete sales data:
 * • Summary: totalSales, totalRevenue, totalNotesSold
 * • Per-note breakdown with buyer profiles, paginated
 *
 * GET /notes/me/sales?page=1&limit=10&search=
 */
exports.getMySalesDetails = async (topperId, options = {}) => {
  const page  = Math.max(1, parseInt(options.page)  || 1);
  const limit = Math.max(1, parseInt(options.limit) || 10);
  const skip  = (page - 1) * limit;
  const search = options.search || '';

  // 1. All topper's note IDs (optionally filtered by name/subject search)
  const noteFilter = { topperId };
  if (search) {
    noteFilter.$or = [
      { chapterName: { $regex: search, $options: 'i' } },
      { subject:     { $regex: search, $options: 'i' } },
    ];
  }
  const myNotes = await Note.find(noteFilter)
    .select('_id chapterName subject class board price status')
    .lean();

  const myNoteIds = myNotes.map(n => n._id);

  // 2. All successful orders for those notes
  const allOrders = await Order.find({
    noteId:        { $in: myNoteIds },
    paymentStatus: 'SUCCESS',
  })
    .populate({ path: 'studentId', select: '_id' })
    .lean();

  // 3. Global summary
  const totalSales   = allOrders.length;
  const totalRevenue = allOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

  // 4. Group orders by noteId
  const ordersByNote = {};
  allOrders.forEach(o => {
    const key = o.noteId.toString();
    if (!ordersByNote[key]) ordersByNote[key] = [];
    ordersByNote[key].push(o);
  });

  // 5. Only notes that actually sold (have at least 1 order)
  const soldNoteIds = Object.keys(ordersByNote);
  const soldNotes   = myNotes.filter(n => soldNoteIds.includes(n._id.toString()));
  const totalNotesSold = soldNotes.length;

  // 6. Paginate on sold notes
  const paginatedNotes = soldNotes.slice(skip, skip + limit);

  // 7. Collect all student IDs we need to populate
  const neededStudentIds = [];
  paginatedNotes.forEach(note => {
    const orders = ordersByNote[note._id.toString()] || [];
    orders.forEach(o => {
      if (o.studentId?._id) neededStudentIds.push(o.studentId._id);
    });
  });

  // 8. Fetch student profiles in one query
  const studentProfiles = await StudentProfile.find({
    userId: { $in: neededStudentIds },
  })
    .select('userId fullName class board profilePhoto')
    .lean();

  const profileMap = {};
  studentProfiles.forEach(p => { profileMap[p.userId.toString()] = p; });

  // 9. Build per-note response
  const noteBreakdown = paginatedNotes.map(note => {
    const orders  = ordersByNote[note._id.toString()] || [];
    const revenue = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

    const buyers = orders.map(order => {
      const profile = profileMap[order.studentId?._id?.toString()] || {};
      return {
        studentId:   order.studentId?._id,
        name:        profile.fullName  || 'Student',
        class:       profile.class     || null,
        board:       profile.board     || null,
        profilePhoto:profile.profilePhoto || null,
        amountPaid:  order.amountPaid,
        purchasedAt: order.createdAt,
      };
    });

    return {
      noteId:      note._id,
      chapterName: note.chapterName,
      subject:     note.subject,
      class:       note.class,
      board:       note.board,
      price:       note.price,
      status:      note.status,
      totalSales:  orders.length,
      revenue,
      buyers,
    };
  });

  return {
    summary: {
      totalSales,
      totalRevenue,
      totalNotesSold,
    },
    notes: noteBreakdown,
    pagination: {
      currentPage: page,
      totalPages:  Math.ceil(totalNotesSold / limit),
      totalNotesSold,
      limit,
    },
  };
};

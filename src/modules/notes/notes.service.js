const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse").default;

const Note = require("./notes.model");
const TopperProfile = require("../toppers/topper.model");
const Order = require("../orders/order.model");
const StudentProfile = require("../students/student.model");

const storageService = require("../../services/storage.service");
const { convertPdfToImages } = require("../../utils/pdfToImages");

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


  if (!pageCount || pageCount < 1) {
    throw new Error("Invalid PDF file (no pages detected)");
  }

  // 5️⃣ Convert PDF → preview images (ALL pages)
  const previewDir = path.join("uploads", "previews");
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const baseName = `note-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  let generatedFiles = [];
  try {
    generatedFiles = await convertPdfToImages(
      pdfPath,
      previewDir,
      baseName
    );
  } catch (err) {
    throw new Error("Failed to generate preview images from PDF");
  }

  if (!generatedFiles.length) {
    throw new Error("Preview images could not be generated");
  }

  // 6️⃣ Build preview URLs (sorted, real files only)
  const previewImages = generatedFiles
    .sort()
    .map((file) =>
      storageService.getFileUrl(req, `previews/${file}`)
    );

  // 7️⃣ Save note
  const note = await Note.create({
    topperId: userId,

    subject: data.subject,
    chapterName: data.chapterName,
    class: data.class,
    board: data.board,
    price: data.price,
    tags: data.tags || [],

    pdfUrl: storageService.getFileUrl(req, pdfFile.filename),
    pageCount,                // ✅ real count
    previewImages,            // ✅ all pages
    publicPreviewCount: 3,    // students see first 3 pages

    status: "UNDER_REVIEW",
  });

  return note;
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

  // 👀 Public preview (first N pages)
  return {
    pages: note.previewImages.slice(0, note.publicPreviewCount),
    totalPages: note.pageCount,
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

  // 3️⃣ Fetch student profiles
  const studentIds = orders.map((o) => o.studentId._id);

  const students = await StudentProfile.find({
    userId: { $in: studentIds },
  })
    .select("fullName class board profilePhoto")
    .lean();

  // 4️⃣ Map response
  return orders.map((order) => {
    const profile = students.find(
      (s) => s.userId.toString() === order.studentId._id.toString()
    );

    return {
      studentName: profile?.fullName || "Student",
      class: profile?.class,
      board: profile?.board,
      profilePhoto: profile?.profilePhoto || null,
      purchasedAt: order.createdAt,
    };
  });
};

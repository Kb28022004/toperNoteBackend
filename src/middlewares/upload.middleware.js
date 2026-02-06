const multer = require("multer");
const fs = require("fs");
const path = require("path");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = "uploads/others";

    if (file.fieldname === "pdf") {
      dir = "uploads/pdfs";
    }

    if (file.fieldname === "previewImages") {
      dir = "uploads/previews";
    }

    if (file.fieldname === "profilePhoto") {
      dir = "uploads/profiles";
    }

    if (file.fieldname === "marksheet") {
      dir = "uploads/marksheets";
    }

    ensureDir(dir);
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "pdf") {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
  }

  if (file.fieldname === "previewImages") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Preview must be an image"), false);
    }
  }

  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
});

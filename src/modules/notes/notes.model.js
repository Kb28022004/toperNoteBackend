const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    topperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // 📄 FILE INFO
    pdfUrl: {
      type: String,
      required: true,
    },

previewImages: {
  type: [String], // ALL page images (admin)
  default: [],
},

publicPreviewCount: {
  type: Number,
  default: 3, // students see first 3 pages
},

    pageCount: {
      type: Number,
      required: true,
      min: 1,
    },

    // 📘 ACADEMIC INFO
    subject: {
      type: String,
      required: true,
      index: true,
    },

    chapterName: {
      type: String,
      required: true,
      trim: true,
    },

    class: {
      type: String,
      enum: ['10', '12'],
      required: true,
    },

    board: {
      type: String,
      enum: ['CBSE', 'ICSE', 'STATE'],
      required: true,
    },

    // 💰 PRICING
    price: {
      type: Number,
      min: 0,
      max: 499,
      required: true,
    },

    // 🏷️ META
    tags: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'REJECTED'],
      default: 'UNDER_REVIEW',
      index: true,
    },

    adminRemark: String,

    // 📊 STATS
    stats: {
      soldCount: { type: Number, default: 0 },
      ratingAvg: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);

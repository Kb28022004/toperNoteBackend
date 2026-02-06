const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const controller = require('./admin.controller');

// Get all pending topper profiles
router.get(
  '/toppers/pending',
  auth,
  role('ADMIN'),
  controller.getPendingToppers
);

// Approve topper
router.post(
  '/toppers/:id/approve',
  auth,
  role('ADMIN'),
  controller.approveTopper
);

// Reject topper
router.post(
  '/toppers/:id/reject',
  auth,
  role('ADMIN'),
  controller.rejectTopper
);

// Get all pending notes

router.get(
  '/notes/pending',
  auth,
  role('ADMIN'),
  controller.getPendingNotes
);

//. Approve note

router.post(
  '/notes/:noteId/approve',
  auth,
  role('ADMIN'),
  controller.approveNote
);

 // Reject note
router.post(
  '/notes/:noteId/reject',
  auth,
  role('ADMIN'),
  controller.rejectNote
);

// preview note (admin only)
router.get(
  '/notes/:noteId/preview',
  auth,
  role('ADMIN'),
  controller.previewNote
);

module.exports = router;

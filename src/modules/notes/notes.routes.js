const router = require('express').Router();
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const upload = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const controller = require('./notes.controller');
const { createNoteSchema } = require('./notes.validation');

router.post(
  '/',
  auth,
  role('TOPPER'),
  upload.fields([
  { name: 'pdf', maxCount: 1 }
]),
  validate(createNoteSchema),
  controller.uploadNote
);

router.get(
  '/me',
  auth,
  role('TOPPER'),
  controller.getMyNotes
);

// Admin: Get all pending notes
router.get(
  '/admin/pending',
  auth,
  role('ADMIN'),
  controller.getPendingNotes
);

// Admin: Approve/Reject note
router.patch(
  '/admin/:noteId/status',
  auth,
  role('ADMIN'),
  // Add validation middleware here if needed
  controller.updateNoteStatus
);

// Get all approved notes (public/student)
router.get(
  '/',
  auth, // Require login (Student/Topper/Admin)
  controller.getApprovedNotes
);

// Get all approved notes (public)
router.get(
  '/:noteId/buyers',
  auth,
  role('TOPPER'),
  controller.getNoteBuyers
);
// Note preview (accessible to buyers and admin)
router.get(
  '/:noteId/preview',
  auth,
  controller.getNotePreview
);

// Get note details (Single Note Page)
router.get(
  '/:noteId',
  auth,
  controller.getNoteDetails
);

module.exports = router;

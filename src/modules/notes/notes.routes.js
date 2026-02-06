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
  { name: 'pdf', maxCount: 1 },          
  { name: 'previewImages', maxCount: 5 } 
]),
  validate(createNoteSchema),
  controller.uploadNote
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

module.exports = router;

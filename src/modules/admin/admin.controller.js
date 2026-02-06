const adminService = require('./admin.service');

// Get all pending topper profiles

exports.getPendingToppers = async (req, res, next) => {
  try {
    const toppers = await adminService.getPendingToppers();
    res.json({ success: true, data: toppers });
  } catch (err) {
    next(err);
  }
};

//  Approve topper

exports.approveTopper = async (req, res, next) => {
  try {
    const result = await adminService.approveTopper(req.params.id);
    res.json({ success: true, message: result });
  } catch (err) {
    next(err);
  }
};

//  Reject topper

exports.rejectTopper = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminService.rejectTopper(req.params.id, reason);
    res.json({ success: true, message: result });
  } catch (err) {
    next(err);
  }
};


// Get all notes waiting for approval
exports.getPendingNotes = async (req, res, next) => {
  try {
    const notes = await adminService.getPendingNotes();
    res.json({
      success: true,
      data: notes,
    });
  } catch (err) {
    next(err);
  }
};

// Approve a note
exports.approveNote = async (req, res, next) => {
  try {
    const result = await adminService.approveNote(req.params.noteId);
    res.json({
      success: true,
      message: result,
    });
  } catch (err) {
    next(err);
  }
};

// Reject a note
exports.rejectNote = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminService.rejectNote(
      req.params.noteId,
      reason
    );

    res.json({
      success: true,
      message: result,
    });
  } catch (err) {
    next(err);
  }
};

// preview note (admin only)
exports.previewNote = async (req, res, next) => {
  try {
    const data = await adminService.getNotePreview(
      req.user,
      req.params.noteId
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

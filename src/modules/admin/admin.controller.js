const adminService = require('./admin.service');

// Create Admin Profile
exports.createProfile = async (req, res, next) => {
    try {
        const result = await adminService.createProfile(
            req.user.id,
            req.body,
            req.file,
            req
        );
        res.status(201).json({
            success: true,
            message: 'Admin profile created successfully',
            data: result
        });
    } catch (err) {
        next(err);
    }
};

// Get all pending topper profiles
exports.getPendingToppers = async (req, res, next) => {
  try {
    const { page, limit, search, expertiseClass, stream, board, status } = req.query;
    const result = await adminService.getToppers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      expertiseClass,
      stream,
      board,
      status: status || "PENDING",
      req
    });
    res.json({ success: true, ...result });
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


// Get all notes by status
exports.getPendingNotes = async (req, res, next) => {
  try {
    const { status } = req.query;
    const notes = await adminService.getNotesByStatus(status || 'UNDER_REVIEW');
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

const noteService = require('./notes.service');

exports.uploadNote = async (req, res, next) => {
  try {
    const note = await noteService.uploadNote(
      req.user.id,
      req.body,
      req.files,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Note submitted for admin review',
      data: note,
    });
  } catch (err) {
    next(err);
  }
};
exports.getNotePreview = async (req, res, next) => {
  try {
    const data = await noteService.getNotePreview(
      req.user,
      req.params.noteId
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getNoteBuyers = async (req, res, next) => {
  try {
    const buyers = await noteService.getNoteBuyers(
      req.user.id,
      req.params.noteId
    );

    res.json({
      success: true,
      data: buyers,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPendingNotes = async (req, res, next) => {
  try {
    const notes = await noteService.getPendingNotes();
    res.json({
      success: true,
      data: notes,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateNoteStatus = async (req, res, next) => {
  try {
    const { status, adminRemark } = req.body;
    const note = await noteService.updateNoteStatus(
      req.params.noteId,
      status, 
      adminRemark
    );

    res.json({
      success: true,
      message: `Note status updated to ${status}`,
      data: note,
    });
  } catch (err) {
    next(err);
  }
};

exports.getApprovedNotes = async (req, res, next) => {
  try {
    // Pass full user object for role-based personalization
    const result = await noteService.getAllApprovedNotes(req.user, req.query);

    console.log("result",result.notes);
    
    res.json({
      success: true,
      data: result.notes,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

exports.getNoteDetails = async (req, res, next) => {
  try {
    const data = await noteService.getNoteDetails(req.params.noteId, req.user?.id, req.user?.role);
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyNotes = async (req, res, next) => {
  try {
    const notes = await noteService.getMyNotes(req.user.id);
    res.json({
      success: true,
      data: notes,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPurchasedNotes = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await noteService.getPurchasedNotes(req.user.id, { search, page, limit });
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

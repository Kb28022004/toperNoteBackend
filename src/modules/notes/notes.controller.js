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

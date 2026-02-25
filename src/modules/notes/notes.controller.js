const noteService = require('./notes.service');
const { sendSuccess, sendError } = require('../../utils/apiResponse');

exports.uploadNote = async (req, res, next) => {
    try {
        const note = await noteService.uploadNote(req.user.id, req.body, req.files, req);
        return sendSuccess(res, 'Note submitted for admin review', note, null, 201);
    } catch (err) {
        next(err);
    }
};

exports.getNotePreview = async (req, res, next) => {
    try {
        const data = await noteService.getNotePreview(req.user, req.params.noteId);
        return sendSuccess(res, 'Note preview fetched', data);
    } catch (err) {
        next(err);
    }
};

exports.getNoteBuyers = async (req, res, next) => {
    try {
        const buyers = await noteService.getNoteBuyers(req.user.id, req.params.noteId);
        return sendSuccess(res, 'Buyers fetched', buyers);
    } catch (err) {
        next(err);
    }
};

exports.getPendingNotes = async (req, res, next) => {
    try {
        const notes = await noteService.getPendingNotes();
        return sendSuccess(res, 'Pending notes fetched', notes);
    } catch (err) {
        next(err);
    }
};

exports.updateNoteStatus = async (req, res, next) => {
    try {
        const { status, adminRemark } = req.body;
        const note = await noteService.updateNoteStatus(req.params.noteId, status, adminRemark);
        return sendSuccess(res, `Note status updated to ${status}`, note);
    } catch (err) {
        next(err);
    }
};

exports.getApprovedNotes = async (req, res, next) => {
    try {
        const result = await noteService.getAllApprovedNotes(req.user, req.query);
        return sendSuccess(res, 'Notes fetched', result.notes, result.pagination);
    } catch (err) {
        next(err);
    }
};

exports.getNoteDetails = async (req, res, next) => {
    try {
        const data = await noteService.getNoteDetails(req.params.noteId, req.user?.id, req.user?.role);
        return sendSuccess(res, 'Note details fetched', data);
    } catch (err) {
        next(err);
    }
};

exports.getMyNotes = async (req, res, next) => {
    try {
        const { search, status, sortBy, page, limit } = req.query;
        const result = await noteService.getMyNotes(req.user.id, { search, status, sortBy, page, limit });
        return sendSuccess(res, 'Your notes fetched', result);
    } catch (err) {
        next(err);
    }
};

exports.getPurchasedNotes = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;
        const result = await noteService.getPurchasedNotes(req.user.id, { search, page, limit });
        return sendSuccess(res, 'Purchased notes fetched', result.notes, {
            total: result.total,
            page: result.page,
            totalPages: result.totalPages
        });
    } catch (err) {
        next(err);
    }
};

exports.getMySalesDetails = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;
        const result = await noteService.getMySalesDetails(req.user.id, { search, page, limit });
        return sendSuccess(res, 'Sales details fetched', result);
    } catch (err) {
        next(err);
    }
};

exports.toggleFavoriteNote = async (req, res, next) => {
    try {
        const result = await noteService.toggleFavoriteNote(req.user.id, req.params.noteId);
        return sendSuccess(res, result.message, result);
    } catch (err) {
        next(err);
    }
};

exports.getFavoriteNotes = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;
        const result = await noteService.getFavoriteNotes(req.user.id, { search, page, limit });
        return sendSuccess(res, 'Favorite notes fetched', result.notes, {
            total: result.total,
            page: result.page,
            totalPages: result.totalPages
        });
    } catch (err) {
        next(err);
    }
};


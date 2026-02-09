exports.getFileUrl = (req, filename) => {
  // If filename includes a directory path (e.g. 'pdfs/file.pdf' or 'previews/img.png'), use it directly
  if (filename.includes('/') || filename.includes('\\')) {
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  }
  // Fallback: Default to 'others' directory for backward compatibility
  return `${req.protocol}://${req.get('host')}/uploads/others/${filename}`;
};

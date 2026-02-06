exports.getFileUrl = (req, filename) => {
  return `${req.protocol}://${req.get('host')}/uploads/others/${filename}`;
};

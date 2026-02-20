const jwtService = require('../services/jwt.service');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwtService.verifyToken(token);
    req.user = decoded;
  } catch (err) {
    // Invalid token, just proceed as guest
  }
  next();
};

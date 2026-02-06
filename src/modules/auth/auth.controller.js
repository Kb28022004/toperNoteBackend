const authService = require('./auth.service');

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, role } = req.body;

    if (!phone || !role) {
      return res.status(400).json({
        message: 'Phone and role are required',
      });
    }

    const result = await authService.sendOtp(phone, role);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        message: 'Phone and OTP are required',
      });
    }

    const result = await authService.verifyOtp(phone, otp);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

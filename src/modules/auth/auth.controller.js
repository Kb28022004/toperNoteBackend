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
    console.log(`✅ OTP sent successfully to ${phone} for role ${role}`);

    res.status(200).json({
      success: true,
      message: result.message || 'OTP sent successfully',
      data: null
    });
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

    res.status(200).json({
      success: true,
      message: 'Otp has been verified successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

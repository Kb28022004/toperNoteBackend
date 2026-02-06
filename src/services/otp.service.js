const bcrypt = require('bcryptjs');
const Otp = require('../modules/auth/otp.model');

const OTP_EXPIRY_MIN = 5;
const SALT_ROUNDS = 10;

/**
 * Generate OTP
 */
exports.generateOtp = async (phone) => {
  let otp;

  // 🔥 DEV MODE OTP (FREE TESTING)
  if (process.env.NODE_ENV !== 'production') {
    otp = process.env.DEV_OTP || '123456';
  } else {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  // One active OTP per phone (upsert)
  await Otp.findOneAndUpdate(
    { phone },
    {
      phone,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000),
    },
    { upsert: true, new: true }
  );

  // 🚨 NEVER LOG OTP IN PRODUCTION
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📲 DEV OTP for ${phone}: ${otp}`);
  }

  return otp;
};

/**
 * Verify OTP
 */
exports.verifyOtp = async (phone, otp) => {
  const record = await Otp.findOne({ phone });

  if (!record) return false;

  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ phone });
    return false;
  }

  const isValid = await bcrypt.compare(otp, record.otpHash);

  if (isValid) {
    // OTP is single-use
    await Otp.deleteOne({ phone });
  }

  return isValid;
};

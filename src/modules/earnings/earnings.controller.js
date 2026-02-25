const earningsService = require('./earnings.service');

exports.getEarningsSummary = async (req, res, next) => {
  try {
    const data = await earningsService.getEarningsSummary(req.user.id);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const data = await earningsService.getTransactions(req.user.id, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPayoutHistory = async (req, res, next) => {
  try {
    const data = await earningsService.getPayoutHistory(req.user.id, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.requestPayout = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Amount is required' });
    }
    const data = await earningsService.requestPayout(req.user.id, amount);
    res.json({
      success: true,
      message: 'Payout request submitted successfully',
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePayoutSettings = async (req, res, next) => {
  try {
    const data = await earningsService.updatePayoutSettings(req.user.id, req.body);
    res.json({
      success: true,
      message: 'Payout settings updated successfully',
      data: data.payoutSettings,
    });
  } catch (err) {
    next(err);
  }
};

const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getAuthUrl, exchangeCodeForTokens } = require('../services/calendarService');

// @route GET /api/calendar/oauth/connect  (protected — returns the consent URL)
const connect = asyncHandler(async (req, res) => {
  // Encode userId as state so the callback (no auth header available, browser redirect) knows who this is
  const state = jwt.sign({ userId: req.user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.json({ url: getAuthUrl(state) });
});

// @route GET /api/calendar/oauth/callback  (public — Google redirects here)
const callback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.redirect(`${process.env.CLIENT_URL}/calendar-connected?status=error`);
  }
  try {
    const { userId } = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await exchangeCodeForTokens(code);
    await User.findByIdAndUpdate(userId, { googleTokens: tokens, googleCalendarConnected: true });
    return res.redirect(`${process.env.CLIENT_URL}/calendar-connected?status=success`);
  } catch (err) {
    console.error('Google OAuth callback failed:', err.message);
    return res.redirect(`${process.env.CLIENT_URL}/calendar-connected?status=error`);
  }
});

module.exports = { connect, callback };

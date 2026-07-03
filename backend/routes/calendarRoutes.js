const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { connect, callback } = require('../controllers/calendarController');

router.get('/oauth/connect', protect, connect);
router.get('/oauth/callback', callback); // public — Google redirects here

module.exports = router;

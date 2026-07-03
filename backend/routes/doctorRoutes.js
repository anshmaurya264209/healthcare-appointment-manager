const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getOwnProfile,
  listMyAppointments,
  getAppointmentDetail,
  completeVisit,
} = require('../controllers/doctorController');

router.use(protect, authorize('doctor'));

router.get('/me/profile', getOwnProfile);
router.get('/appointments', listMyAppointments);
router.get('/appointments/:id', getAppointmentDetail);
router.post('/appointments/:id/complete', completeVisit);

module.exports = router;

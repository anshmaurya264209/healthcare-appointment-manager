const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  searchDoctors,
  getDoctorSlots,
  listMyAppointments,
  getAppointmentDetail,
} = require('../controllers/patientController');

router.use(protect, authorize('patient'));

router.get('/doctors', searchDoctors);
router.get('/doctors/:profileId/slots', getDoctorSlots);
router.get('/appointments', listMyAppointments);
router.get('/appointments/:id', getAppointmentDetail);

module.exports = router;

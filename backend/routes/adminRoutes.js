const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createDoctor,
  listDoctorsAdmin,
  updateDoctorProfile,
  addLeaveDay,
  removeLeaveDay,
  listPatients,
  setUserActiveStatus,
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.post('/doctors', createDoctor);
router.get('/doctors', listDoctorsAdmin);
router.put('/doctors/:profileId', updateDoctorProfile);
router.post('/doctors/:profileId/leave', addLeaveDay);
router.delete('/doctors/:profileId/leave/:date', removeLeaveDay);

router.get('/patients', listPatients);
router.put('/users/:userId/deactivate', setUserActiveStatus);

module.exports = router;

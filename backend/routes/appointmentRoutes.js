const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { holdSlot, confirmBooking, cancelAppointment } = require('../controllers/appointmentController');

router.post('/hold', protect, authorize('patient'), holdSlot);
router.post('/:id/confirm', protect, authorize('patient'), confirmBooking);
router.delete('/:id', protect, authorize('patient', 'doctor', 'admin'), cancelAppointment);

module.exports = router;

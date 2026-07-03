const asyncHandler = require('express-async-handler');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const { getAvailableSlots } = require('../utils/slotUtils');

// @route GET /api/patient/doctors?specialization=Cardiology
const searchDoctors = asyncHandler(async (req, res) => {
  const filter = { isAcceptingBookings: true };
  if (req.query.specialization) {
    filter.specialization = new RegExp(req.query.specialization, 'i');
  }
  const doctors = await DoctorProfile.find(filter).populate('user', 'name email phone isActive');
  res.json({ doctors: doctors.filter((d) => d.user && d.user.isActive) });
});

// @route GET /api/patient/doctors/:profileId/slots?date=YYYY-MM-DD
const getDoctorSlots = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('date query param is required (YYYY-MM-DD)');
  }
  const profile = await DoctorProfile.findById(req.params.profileId);
  if (!profile) {
    res.status(404);
    throw new Error('Doctor not found');
  }
  const slots = await getAvailableSlots(profile, date);
  res.json({ date, slots });
});

// @route GET /api/patient/appointments
const listMyAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ patient: req.user._id })
    .populate('doctor', 'name email')
    .populate('doctorProfile', 'specialization')
    .sort({ date: -1, startTime: 1 });
  res.json({ appointments });
});

// @route GET /api/patient/appointments/:id
const getAppointmentDetail = asyncHandler(async (req, res) => {
  const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id }).populate(
    'doctor',
    'name email'
  );
  if (!appt) {
    res.status(404);
    throw new Error('Appointment not found');
  }
  res.json({ appointment: appt });
});

module.exports = { searchDoctors, getDoctorSlots, listMyAppointments, getAppointmentDetail };

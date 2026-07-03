const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const { sendEmail, templates } = require('../services/emailService');
const { deleteEventForUser } = require('../services/calendarService');

// @route POST /api/admin/doctors  — create a doctor account + profile
const createDoctor = asyncHandler(async (req, res) => {
  const { name, email, password, phone, specialization, slotDurationMinutes, workingHours, bio, consultationFee } =
    req.body;

  if (!name || !email || !password || !specialization) {
    res.status(400);
    throw new Error('name, email, password and specialization are required');
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({ name, email, password, phone, role: 'doctor' });
  const profile = await DoctorProfile.create({
    user: user._id,
    specialization,
    slotDurationMinutes: slotDurationMinutes || 30,
    workingHours: workingHours || [],
    bio: bio || '',
    consultationFee: consultationFee || 0,
  });

  res.status(201).json({ doctor: { _id: user._id, name: user.name, email: user.email, phone: user.phone }, profile });
});

// @route GET /api/admin/doctors
const listDoctorsAdmin = asyncHandler(async (req, res) => {
  const profiles = await DoctorProfile.find().populate('user', 'name email phone isActive');
  res.json({ doctors: profiles });
});

// @route PUT /api/admin/doctors/:profileId — update specialization/hours/slot duration/fee
const updateDoctorProfile = asyncHandler(async (req, res) => {
  const { specialization, slotDurationMinutes, workingHours, bio, consultationFee, isAcceptingBookings } = req.body;
  const profile = await DoctorProfile.findById(req.params.profileId);
  if (!profile) {
    res.status(404);
    throw new Error('Doctor profile not found');
  }

  if (specialization !== undefined) profile.specialization = specialization;
  if (slotDurationMinutes !== undefined) profile.slotDurationMinutes = slotDurationMinutes;
  if (workingHours !== undefined) profile.workingHours = workingHours;
  if (bio !== undefined) profile.bio = bio;
  if (consultationFee !== undefined) profile.consultationFee = consultationFee;
  if (isAcceptingBookings !== undefined) profile.isAcceptingBookings = isAcceptingBookings;

  await profile.save();
  res.json({ profile });
});

// @route POST /api/admin/doctors/:profileId/leave
// Body: { date: "YYYY-MM-DD" }
// Marks a doctor on leave for a date and, if there are existing confirmed bookings,
// cancels them, deletes their calendar events, and emails the affected patients.
const addLeaveDay = asyncHandler(async (req, res) => {
  const { date } = req.body;
  if (!date) {
    res.status(400);
    throw new Error('date is required (YYYY-MM-DD)');
  }

  const profile = await DoctorProfile.findById(req.params.profileId).populate('user', 'name email');
  if (!profile) {
    res.status(404);
    throw new Error('Doctor profile not found');
  }

  const alreadyOnLeave = profile.leaveDays.some((d) => new Date(d).toISOString().slice(0, 10) === date);
  if (!alreadyOnLeave) {
    profile.leaveDays.push(new Date(`${date}T00:00:00Z`));
    await profile.save();
  }

  // Find affected confirmed appointments on that date
  const affected = await Appointment.find({
    doctor: profile.user._id,
    date,
    status: 'confirmed',
  }).populate('patient', 'name email');

  const notifications = [];
  for (const appt of affected) {
    appt.status = 'leave-cancelled';
    appt.cancelledBy = 'admin';
    appt.cancellationReason = `Dr. ${profile.user.name} is on leave on ${date}`;
    await appt.save();

    // Best-effort calendar cleanup
    if (appt.googleEvent?.patientEventId) {
      await deleteEventForUser(appt.patient._id, appt.googleEvent.patientEventId);
    }
    if (appt.googleEvent?.doctorEventId) {
      await deleteEventForUser(appt.doctor, appt.googleEvent.doctorEventId);
    }

    // Best-effort email — failures logged, never thrown
    const { subject, html } = templates.cancellation(appt, appt.patient.name, appt.cancellationReason);
    const result = await sendEmail({ to: appt.patient.email, toName: appt.patient.name, subject, html });
    notifications.push({ appointmentId: appt._id, patient: appt.patient.email, emailSent: result.success });
  }

  res.json({
    message: `Leave day added. ${affected.length} appointment(s) affected.`,
    leaveDays: profile.leaveDays,
    affectedAppointments: notifications,
  });
});

// @route DELETE /api/admin/doctors/:profileId/leave/:date
const removeLeaveDay = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findById(req.params.profileId);
  if (!profile) {
    res.status(404);
    throw new Error('Doctor profile not found');
  }
  profile.leaveDays = profile.leaveDays.filter(
    (d) => new Date(d).toISOString().slice(0, 10) !== req.params.date
  );
  await profile.save();
  res.json({ leaveDays: profile.leaveDays });
});

// @route GET /api/admin/patients
const listPatients = asyncHandler(async (req, res) => {
  const patients = await User.find({ role: 'patient' }).select('name email phone isActive createdAt');
  res.json({ patients });
});

// @route PUT /api/admin/users/:userId/deactivate
const setUserActiveStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(req.params.userId, { isActive: !!isActive }, { new: true });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ user: { _id: user._id, isActive: user.isActive } });
});

module.exports = {
  createDoctor,
  listDoctorsAdmin,
  updateDoctorProfile,
  addLeaveDay,
  removeLeaveDay,
  listPatients,
  setUserActiveStatus,
};

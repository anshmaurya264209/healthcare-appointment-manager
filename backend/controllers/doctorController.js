const asyncHandler = require('express-async-handler');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const { generatePostVisitSummary } = require('../services/llmService');
const { sendEmail, templates } = require('../services/emailService');

// @route GET /api/doctor/me/profile
const getOwnProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id });
  if (!profile) {
    res.status(404);
    throw new Error('Doctor profile not found. Ask an admin to set it up.');
  }
  res.json({ profile });
});

// @route GET /api/doctor/appointments?status=confirmed&date=YYYY-MM-DD
const listMyAppointments = asyncHandler(async (req, res) => {
  const filter = { doctor: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.date) filter.date = req.query.date;

  const appointments = await Appointment.find(filter)
    .populate('patient', 'name email phone')
    .sort({ date: 1, startTime: 1 });
  res.json({ appointments });
});

// @route GET /api/doctor/appointments/:id — includes AI pre-visit summary for quick pre-visit review
const getAppointmentDetail = asyncHandler(async (req, res) => {
  const appt = await Appointment.findOne({ _id: req.params.id, doctor: req.user._id }).populate(
    'patient',
    'name email phone'
  );
  if (!appt) {
    res.status(404);
    throw new Error('Appointment not found');
  }
  res.json({ appointment: appt });
});

// @route POST /api/doctor/appointments/:id/complete
// Body: { notes, prescription: [{medicine, dosage, frequency, durationDays, instructions}] }
// Generates the AI patient-friendly post-visit summary and emails the patient.
const completeVisit = asyncHandler(async (req, res) => {
  const { notes, prescription } = req.body;
  if (!notes) {
    res.status(400);
    throw new Error('Clinical notes are required to complete the visit');
  }

  const appt = await Appointment.findOne({ _id: req.params.id, doctor: req.user._id }).populate(
    'patient',
    'name email'
  );
  if (!appt) {
    res.status(404);
    throw new Error('Appointment not found');
  }
  if (appt.status !== 'confirmed') {
    res.status(400);
    throw new Error(`Cannot complete an appointment with status '${appt.status}'`);
  }

  appt.postVisitNotes = notes;
  appt.prescription = prescription || [];
  appt.status = 'completed';

  // LLM call — failures degrade gracefully (see llmService), visit is still marked complete.
  appt.postVisitSummary = await generatePostVisitSummary(notes, appt.prescription);

  await appt.save();

  // Best-effort patient notification with the friendly summary
  await sendEmail({
    to: appt.patient.email,
    toName: appt.patient.name,
    subject: 'Your visit summary is ready',
    html: `<p>Hi ${appt.patient.name},</p>
      <p>${appt.postVisitSummary.summaryText}</p>
      <p><strong>Medication schedule:</strong> ${appt.postVisitSummary.medicationSchedule}</p>
      <p><strong>Follow-up steps:</strong> ${appt.postVisitSummary.followUpSteps}</p>
      <p>— Clinic Team</p>`,
  });

  res.json({ appointment: appt });
});

module.exports = { getOwnProfile, listMyAppointments, getAppointmentDetail, completeVisit };

const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const User = require('../models/User');
const { generatePreVisitSummary } = require('../services/llmService');
const { sendEmail, templates } = require('../services/emailService');
const { createEventForUser, updateEventForUser, deleteEventForUser } = require('../services/calendarService');
const { getAvailableSlots } = require('../utils/slotUtils');

const HOLD_MINUTES = parseInt(process.env.SLOT_HOLD_MINUTES || '5', 10);

function combineDateTime(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00Z`).toISOString();
}

// @route POST /api/appointments/hold
// Body: { doctorProfileId, date, startTime }
// Step 1 of booking: reserve the slot for HOLD_MINUTES while the patient fills the symptom form.
// Relies on the unique partial index on (doctor, date, startTime) to atomically prevent
// two patients from holding the same slot — a duplicate-key error becomes a clean 409.
const holdSlot = asyncHandler(async (req, res) => {
  const { doctorProfileId, date, startTime } = req.body;
  if (!doctorProfileId || !date || !startTime) {
    res.status(400);
    throw new Error('doctorProfileId, date and startTime are required');
  }

  const profile = await DoctorProfile.findById(doctorProfileId);
  if (!profile) {
    res.status(404);
    throw new Error('Doctor not found');
  }

  // Re-validate the slot is theoretically available (working hours / not on leave)
  const available = await getAvailableSlots(profile, date);
  const match = available.find((s) => s.startTime === startTime);
  if (!match) {
    res.status(409);
    throw new Error('This slot is no longer available. Please pick another.');
  }

  try {
    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: profile.user,
      doctorProfile: profile._id,
      date,
      startTime: match.startTime,
      endTime: match.endTime,
      status: 'held',
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
    });
    res.status(201).json({
      appointment,
      holdExpiresInMinutes: HOLD_MINUTES,
      message: 'Slot held. Please submit your symptoms and confirm within the hold window.',
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('This slot was just taken by another patient. Please choose a different slot.');
    }
    throw err;
  }
});

// @route POST /api/appointments/:id/confirm
// Body: { symptoms }
// Step 2 of booking: patient submits symptoms, LLM generates the pre-visit summary,
// the hold is converted to a confirmed booking (holdExpiresAt unset so TTL no longer applies),
// emails go out to both sides, and calendar events are created if connected.
const confirmBooking = asyncHandler(async (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms) {
    res.status(400);
    throw new Error('symptoms is required to confirm the booking');
  }

  const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id }).populate(
    'doctor',
    'name email'
  );
  if (!appt) {
    res.status(404);
    throw new Error('Held appointment not found');
  }
  if (appt.status !== 'held') {
    res.status(400);
    throw new Error(`This appointment is '${appt.status}' and cannot be confirmed`);
  }
  if (appt.holdExpiresAt && appt.holdExpiresAt.getTime() < Date.now()) {
    res.status(410);
    throw new Error('Your slot hold has expired. Please select a slot again.');
  }

  appt.symptoms = symptoms;
  appt.preVisitSummary = await generatePreVisitSummary(symptoms);
  appt.status = 'confirmed';
  appt.holdExpiresAt = undefined; // remove from TTL index scope entirely
  await appt.save();
  await Appointment.updateOne({ _id: appt._id }, { $unset: { holdExpiresAt: '' } });

  const patient = req.user;
  const doctor = appt.doctor;

  // --- Email notifications (best-effort; never throw) ---
  const patientTpl = templates.bookingConfirmation(appt, doctor.name, patient.name);
  const patientEmailResult = await sendEmail({ to: patient.email, toName: patient.name, subject: patientTpl.subject, html: patientTpl.html });

  const doctorTpl = templates.doctorNewBooking(appt, doctor.name, patient.name);
  const doctorEmailResult = await sendEmail({ to: doctor.email, toName: doctor.name, subject: doctorTpl.subject, html: doctorTpl.html });

  // --- Google Calendar (best-effort; never throw) ---
  const startISO = combineDateTime(appt.date, appt.startTime);
  const endISO = combineDateTime(appt.date, appt.endTime);
  const eventPayload = {
    summary: `Appointment: ${patient.name} with Dr. ${doctor.name}`,
    description: `Chief complaint: ${appt.preVisitSummary.chiefComplaint || 'Pending'}`,
    startISO,
    endISO,
  };
  appt.googleEvent.patientEventId = await createEventForUser(patient._id, eventPayload);
  appt.googleEvent.doctorEventId = await createEventForUser(doctor._id, eventPayload);
  await appt.save();

  res.json({
    appointment: appt,
    notifications: {
      patientEmailSent: patientEmailResult.success,
      doctorEmailSent: doctorEmailResult.success,
      patientCalendarSynced: !!appt.googleEvent.patientEventId,
      doctorCalendarSynced: !!appt.googleEvent.doctorEventId,
    },
  });
});

// @route DELETE /api/appointments/:id  (cancel — patient, doctor, or admin)
const cancelAppointment = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const appt = await Appointment.findById(req.params.id).populate('patient', 'name email').populate('doctor', 'name email');
  if (!appt) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  const isOwnerPatient = req.user.role === 'patient' && String(appt.patient._id) === String(req.user._id);
  const isOwnerDoctor = req.user.role === 'doctor' && String(appt.doctor._id) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwnerPatient && !isOwnerDoctor && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to cancel this appointment');
  }
  if (!['held', 'confirmed'].includes(appt.status)) {
    res.status(400);
    throw new Error(`Cannot cancel an appointment with status '${appt.status}'`);
  }

  appt.status = 'cancelled';
  appt.cancelledBy = isAdmin ? 'admin' : req.user.role;
  appt.cancellationReason = reason || 'No reason provided';
  appt.holdExpiresAt = undefined;
  await appt.save();
  await Appointment.updateOne({ _id: appt._id }, { $unset: { holdExpiresAt: '' } });

  // Calendar cleanup (best-effort)
  if (appt.googleEvent?.patientEventId) await deleteEventForUser(appt.patient._id, appt.googleEvent.patientEventId);
  if (appt.googleEvent?.doctorEventId) await deleteEventForUser(appt.doctor._id, appt.googleEvent.doctorEventId);

  // Email both sides (best-effort)
  const patientTpl = templates.cancellation(appt, appt.patient.name, appt.cancellationReason);
  await sendEmail({ to: appt.patient.email, toName: appt.patient.name, subject: patientTpl.subject, html: patientTpl.html });
  const doctorTpl = templates.cancellation(appt, appt.doctor.name, appt.cancellationReason);
  await sendEmail({ to: appt.doctor.email, toName: appt.doctor.name, subject: doctorTpl.subject, html: doctorTpl.html });

  res.json({ appointment: appt });
});

module.exports = { holdSlot, confirmBooking, cancelAppointment };

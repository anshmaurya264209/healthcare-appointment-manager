const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { sendEmail, templates } = require('../services/emailService');

/**
 * Simple in-memory retry tracker for failed sends within this process's lifetime.
 * For production-grade durability this should be backed by a persistent queue
 * (BullMQ / Agenda) — noted in README as a future improvement.
 */
const failedSendRetryQueue = [];

const MAX_RETRIES = 3;

async function sendWithRetry(payload, attempt = 1) {
  const result = await sendEmail(payload);
  if (!result.success && attempt < MAX_RETRIES) {
    failedSendRetryQueue.push({ payload, attempt: attempt + 1 });
  }
  return result;
}

async function drainRetryQueue() {
  const batch = failedSendRetryQueue.splice(0, failedSendRetryQueue.length);
  for (const item of batch) {
    // eslint-disable-next-line no-await-in-loop
    await sendWithRetry(item.payload, item.attempt);
  }
}

/**
 * Sends a 24h-ahead appointment reminder to patients whose appointment is confirmed
 * and falls exactly one day from now (window matches the cron interval to avoid duplicates
 * would ideally be tracked via a `reminderSentAt` field — added below).
 */
async function sendAppointmentReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const appointments = await Appointment.find({
    date: dateStr,
    status: 'confirmed',
  })
    .populate('patient', 'name email')
    .populate('doctor', 'name email');

  for (const appt of appointments) {
    // eslint-disable-next-line no-await-in-loop
    const patientTpl = templates.reminder(appt, appt.patient.name);
    // eslint-disable-next-line no-await-in-loop
    await sendWithRetry({ to: appt.patient.email, toName: appt.patient.name, subject: patientTpl.subject, html: patientTpl.html });

    // eslint-disable-next-line no-await-in-loop
    const doctorTpl = templates.reminder(appt, appt.doctor.name);
    // eslint-disable-next-line no-await-in-loop
    await sendWithRetry({ to: appt.doctor.email, toName: appt.doctor.name, subject: doctorTpl.subject, html: doctorTpl.html });
  }
}

/**
 * Sends medication reminders for completed visits whose prescription frequency
 * implies a dose is due. This is a simplified scheduler: it fires once per cron tick
 * for any active prescription (durationDays not yet elapsed since completion).
 * A production system would parse `frequency` into exact times of day.
 */
async function sendMedicationReminders() {
  const now = new Date();
  const completedRecently = await Appointment.find({
    status: 'completed',
    'prescription.0': { $exists: true },
  }).populate('patient', 'name email');

  for (const appt of completedRecently) {
    const completedAt = appt.updatedAt;
    const msElapsed = now - completedAt;
    const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

    for (const item of appt.prescription) {
      if (daysElapsed <= item.durationDays) {
        // eslint-disable-next-line no-await-in-loop
        const tpl = templates.medicationReminder(item.medicine, item.dosage, appt.patient.name);
        // eslint-disable-next-line no-await-in-loop
        await sendWithRetry({ to: appt.patient.email, toName: appt.patient.name, subject: tpl.subject, html: tpl.html });
      }
    }
  }
}

function startReminderJob() {
  const schedule = process.env.REMINDER_CRON || '*/15 * * * *';
  cron.schedule(schedule, async () => {
    try {
      await drainRetryQueue();
      await sendAppointmentReminders();
      await sendMedicationReminders();
    } catch (err) {
      console.error('Reminder job failed:', err.message);
    }
  });
  console.log(`Reminder job scheduled: ${schedule}`);
}

module.exports = { startReminderJob };

const axios = require('axios');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends a transactional email via Brevo's HTTP API.
 * Returns { success, error } instead of throwing, so callers (booking flow, jobs)
 * never crash the request just because the email provider is down.
 */
async function sendEmail({ to, toName, subject, html }) {
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY not configured — skipping email send');
    return { success: false, error: 'BREVO_API_KEY not configured' };
  }

  try {
    await axios.post(
      BREVO_URL,
      {
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Clinic' },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );
    return { success: true };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('Brevo email send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

const templates = {
  bookingConfirmation: (appt, doctorName, patientName) => ({
    subject: `Appointment confirmed — ${appt.date} at ${appt.startTime}`,
    html: `<p>Hi ${patientName},</p>
      <p>Your appointment with <strong>Dr. ${doctorName}</strong> is confirmed for
      <strong>${appt.date} at ${appt.startTime}</strong>.</p>
      <p>We'll send a reminder before your visit. If you need to cancel or reschedule, please do so from your patient portal.</p>
      <p>— Clinic Team</p>`,
  }),
  doctorNewBooking: (appt, doctorName, patientName) => ({
    subject: `New appointment booked — ${appt.date} at ${appt.startTime}`,
    html: `<p>Dr. ${doctorName},</p>
      <p>A new appointment has been booked by <strong>${patientName}</strong> on
      <strong>${appt.date} at ${appt.startTime}</strong>.</p>
      <p>Urgency (AI pre-visit read): <strong>${appt.preVisitSummary?.urgency || 'Pending'}</strong></p>
      <p>— Clinic System</p>`,
  }),
  reminder: (appt, recipientName) => ({
    subject: `Reminder: appointment on ${appt.date} at ${appt.startTime}`,
    html: `<p>Hi ${recipientName},</p>
      <p>This is a reminder of your upcoming appointment on <strong>${appt.date} at ${appt.startTime}</strong>.</p>
      <p>— Clinic Team</p>`,
  }),
  cancellation: (appt, recipientName, reason) => ({
    subject: `Appointment cancelled — ${appt.date} at ${appt.startTime}`,
    html: `<p>Hi ${recipientName},</p>
      <p>Your appointment on <strong>${appt.date} at ${appt.startTime}</strong> has been cancelled.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
      <p>Please book a new slot from the patient portal at your convenience.</p>
      <p>— Clinic Team</p>`,
  }),
  medicationReminder: (medicine, dosage, patientName) => ({
    subject: `Medication reminder: ${medicine}`,
    html: `<p>Hi ${patientName},</p>
      <p>Reminder to take your medication: <strong>${medicine} (${dosage})</strong> as prescribed.</p>
      <p>— Clinic Team</p>`,
  }),
};

module.exports = { sendEmail, templates };

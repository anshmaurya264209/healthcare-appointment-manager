const { google } = require('googleapis');
const User = require('../models/User');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oAuth2Client = getOAuth2Client();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state, // carries the userId so the callback knows whose tokens these are
  });
}

async function exchangeCodeForTokens(code) {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

async function getAuthorizedClientForUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.googleTokens || !user.googleTokens.refresh_token) {
    return null; // user has not connected their calendar
  }
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(user.googleTokens);

  // Persist refreshed access tokens automatically
  oAuth2Client.on('tokens', async (tokens) => {
    const update = { ...user.googleTokens, ...tokens };
    await User.findByIdAndUpdate(userId, { googleTokens: update });
  });

  return oAuth2Client;
}

/**
 * Creates a calendar event for a user (patient or doctor) if they have connected
 * Google Calendar. Silently no-ops (returns null) if not connected or on API failure,
 * so calendar issues never block the booking flow.
 */
async function createEventForUser(userId, { summary, description, startISO, endISO, timeZone }) {
  try {
    const auth = await getAuthorizedClientForUser(userId);
    if (!auth) return null;
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || 'UTC' },
        end: { dateTime: endISO, timeZone: timeZone || 'UTC' },
        reminders: { useDefault: true },
      },
    });
    return res.data.id;
  } catch (err) {
    console.error(`Google Calendar create event failed for user ${userId}:`, err.message);
    return null;
  }
}

async function updateEventForUser(userId, eventId, { summary, description, startISO, endISO, timeZone }) {
  if (!eventId) return null;
  try {
    const auth = await getAuthorizedClientForUser(userId);
    if (!auth) return null;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || 'UTC' },
        end: { dateTime: endISO, timeZone: timeZone || 'UTC' },
      },
    });
    return eventId;
  } catch (err) {
    console.error(`Google Calendar update event failed for user ${userId}:`, err.message);
    return null;
  }
}

async function deleteEventForUser(userId, eventId) {
  if (!eventId) return false;
  try {
    const auth = await getAuthorizedClientForUser(userId);
    if (!auth) return false;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err) {
    console.error(`Google Calendar delete event failed for user ${userId}:`, err.message);
    return false;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  createEventForUser,
  updateEventForUser,
  deleteEventForUser,
};

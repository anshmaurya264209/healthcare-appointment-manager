# Healthcare Appointment & Follow-up Manager

A full-stack (MERN) clinic platform with separate portals for **patients**, **doctors**, and an **admin**.
Patients book appointments and describe symptoms in advance; an LLM (Groq) generates a pre-visit summary
with urgency level for the doctor; after the visit the doctor's notes are converted into a patient-friendly
summary. Both sides get email notifications (Brevo) and Google Calendar sync.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 (Vite), React Router |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT, role-based (`patient` / `doctor` / `admin`) |
| AI | Groq (OpenAI-compatible chat completions) |
| Email | Brevo transactional email API |
| Calendar | Google Calendar API (OAuth 2.0) |
| Background jobs | node-cron |

---

## 1. Project structure

```
healthcare-appointment-manager/
├── backend/
│   ├── config/db.js
│   ├── models/            User, DoctorProfile, Appointment
│   ├── middleware/         auth.js (JWT + role guard), errorHandler.js
│   ├── controllers/        auth, admin, doctor, patient, appointment, calendar
│   ├── routes/
│   ├── services/           emailService (Brevo), llmService (Groq), calendarService (Google)
│   ├── jobs/reminderJob.js  cron: appointment reminders, medication reminders, email retries
│   ├── utils/slotUtils.js   slot generation / availability
│   ├── utils/seedAdmin.js   creates the first admin account
│   └── server.js
├── frontend/
│   └── src/
│       ├── api/axios.js
│       ├── context/AuthContext.jsx
│       ├── components/     Navbar, ProtectedRoute
│       └── pages/           patient/, doctor/, admin/, Login, Register, Home
├── README.md
├── SYSTEM_DESIGN.md
└── .gitignore
```

---

## 2. Setup guide

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- A [Groq API key](https://console.groq.com/keys)
- A [Brevo API key](https://app.brevo.com/settings/keys/api) + a verified sender email
- A Google Cloud project with the Calendar API enabled (see §5)

### Backend

```bash
cd backend
cp .env.example .env      # fill in the values, see table below
npm install
npm run seed               # creates the first admin account (prints email/password)
npm run dev                 # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env       # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # starts on http://localhost:5173
```

### First run
1. Log in as the seeded admin (`npm run seed` prints the credentials).
2. Admin → **Add doctor**: create a doctor profile with specialization, working hours, and slot duration.
3. Log out, register as a patient, search doctors by specialization, and book a slot.

### Environment variables (backend `.env`)

| Variable | Purpose |
|---|---|
| `PORT`, `CLIENT_URL`, `NODE_ENV` | server basics + CORS origin |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | auth token signing |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_API_URL` | LLM pre-/post-visit summaries |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | transactional email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Calendar OAuth |
| `SLOT_HOLD_MINUTES` | how long a slot is reserved while the patient fills the symptom form (default 5) |
| `REMINDER_CRON` | cron schedule for the reminder/retry job (default every 15 min) |

---

## 3. Database schema

**User**
```
name, email (unique), password (hashed), phone, role: patient|doctor|admin,
isActive, googleTokens {access_token, refresh_token, ...}, googleCalendarConnected
```

**DoctorProfile**
```
user (ref User, unique), specialization, bio, slotDurationMinutes,
workingHours: [{ day: Mon..Sun, start: "HH:MM", end: "HH:MM" }],
leaveDays: [Date], consultationFee, isAcceptingBookings
```

**Appointment**
```
patient (ref User), doctor (ref User), doctorProfile (ref DoctorProfile),
date ("YYYY-MM-DD"), startTime, endTime,
status: held|confirmed|cancelled|leave-cancelled|completed|no-show,
holdExpiresAt (TTL field — see §4),
symptoms,
preVisitSummary: { urgency, chiefComplaint, suggestedQuestions[], raw, generatedAt, failed },
postVisitNotes, prescription: [{ medicine, dosage, frequency, durationDays, instructions }],
postVisitSummary: { summaryText, medicationSchedule, followUpSteps, raw, generatedAt, failed },
googleEvent: { patientEventId, doctorEventId },
cancellationReason, cancelledBy
```

Two indexes matter most:
- **Unique partial index** on `(doctor, date, startTime)` for statuses in
  `held|confirmed|completed|no-show` — this is the double-booking guard (see `SYSTEM_DESIGN.md`).
- **TTL index** on `holdExpiresAt` (`expireAfterSeconds: 0`) — auto-expires abandoned slot holds.

---

## 4. API documentation

Base URL: `/api`. All protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Route | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | public | `{name, email, password, phone}` (patient only) |
| POST | `/auth/login` | public | `{email, password}` |
| GET | `/auth/me` | any logged-in user | — |

### Admin
| Method | Route | Body |
|---|---|---|
| POST | `/admin/doctors` | `{name, email, password, phone, specialization, slotDurationMinutes, workingHours, bio, consultationFee}` |
| GET | `/admin/doctors` | — |
| PUT | `/admin/doctors/:profileId` | any subset of profile fields |
| POST | `/admin/doctors/:profileId/leave` | `{date}` — cancels conflicting confirmed bookings & emails patients |
| DELETE | `/admin/doctors/:profileId/leave/:date` | — |
| GET | `/admin/patients` | — |
| PUT | `/admin/users/:userId/deactivate` | `{isActive}` |

### Patient
| Method | Route | Notes |
|---|---|---|
| GET | `/patient/doctors?specialization=` | search doctors |
| GET | `/patient/doctors/:profileId/slots?date=YYYY-MM-DD` | available slots for a date |
| GET | `/patient/appointments` | own appointment history |
| GET | `/patient/appointments/:id` | detail |

### Appointment booking flow
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/appointments/hold` | `{doctorProfileId, date, startTime}` | Step 1: reserves the slot for `SLOT_HOLD_MINUTES` |
| POST | `/appointments/:id/confirm` | `{symptoms}` | Step 2: runs the LLM pre-visit summary, confirms booking, sends emails, creates calendar events |
| DELETE | `/appointments/:id` | `{reason}` | cancel (patient/doctor/admin); cleans up calendar + emails both sides |

### Doctor
| Method | Route | Body |
|---|---|---|
| GET | `/doctor/me/profile` | — |
| GET | `/doctor/appointments?status=&date=` | — |
| GET | `/doctor/appointments/:id` | includes AI pre-visit summary |
| POST | `/doctor/appointments/:id/complete` | `{notes, prescription:[...]}` — runs LLM post-visit summary, emails patient |

### Calendar
| Method | Route | Notes |
|---|---|---|
| GET | `/calendar/oauth/connect` | protected — returns Google consent URL |
| GET | `/calendar/oauth/callback` | public — Google redirects here, stores tokens |

---

## 5. LLM prompts (Groq)

Both calls request **strict JSON** output and are wrapped with graceful fallbacks (see `services/llmService.js`)
so a Groq outage never blocks booking or visit completion — the app falls back to a plain-text version and
flags `failed: true` on the summary object.

**Pre-visit summary** (`generatePreVisitSummary`):
```
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint,
and three suggested questions for the doctor. Symptoms: <symptoms>
```
Expected JSON shape: `{urgency, chiefComplaint, suggestedQuestions: [q1,q2,q3]}`

**Post-visit summary** (`generatePostVisitSummary`):
```
Convert these clinical notes into a patient-friendly summary with medication schedule
and follow-up steps: <notes>

Prescription: <flattened prescription list>
```
Expected JSON shape: `{summaryText, medicationSchedule, followUpSteps}`

Model is configurable via `GROQ_MODEL` (defaults to `llama-3.3-70b-versatile`).

---

## 6. Google Calendar setup (OAuth 2.0)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → configure as "External" (or Internal for a Workspace org),
   add your test users (patient/doctor emails you'll log in with during development).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:5000/api/calendar/oauth/callback` (matches `GOOGLE_REDIRECT_URI`)
5. Copy the generated **Client ID** and **Client Secret** into the backend `.env`.
6. In the app, a logged-in user clicks **"Connect Google Calendar"** on the Home page → redirected to Google
   consent → redirected back to `/calendar-connected`. Refresh tokens are stored on the `User` document.
7. Booking confirmation, cancellation, and leave-day cancellation all create/delete events on **both** the
   patient's and doctor's calendars — but only for users who've connected their calendar. Non-connected users
   simply don't get a calendar event; nothing else in the flow is blocked.

---

## 7. Notification reliability

- All email sends go through `sendEmail()` in `emailService.js`, which **never throws** — it returns
  `{success, error}` so a Brevo outage never breaks booking/cancellation/visit-completion requests.
- The `reminderJob.js` cron job maintains an in-memory retry queue (up to 3 attempts) for failed sends,
  and separately sends 24-hours-ahead appointment reminders and simplified medication reminders based on
  prescription duration. For production durability this in-memory queue should be swapped for a persistent
  job queue (BullMQ/Agenda) — noted as a follow-up.

---

## 8. Known simplifications / follow-ups

- Slot times are stored as strings in the doctor's local time; a production version should store an explicit
  timezone per doctor and convert consistently for cross-timezone patients.
- Medication reminder timing is duration-based, not time-of-day-based (frequency strings like "3x/day" aren't
  parsed into exact send times).
- The retry queue for failed emails is in-memory and resets on server restart.

# System Design Write-up

## Double-booking prevention

The core guard is a **unique partial index** on `Appointment` over `(doctor, date, startTime)`,
scoped to statuses `held | confirmed | completed | no-show`:

```js
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['held','confirmed','completed','no-show'] } } }
);
```

This pushes the correctness guarantee into the database rather than application logic. Two
patients hitting "confirm" on the same slot at the same millisecond will both attempt an insert;
MongoDB accepts one and rejects the other with a duplicate-key error (`code 11000`), which the
appointment controller and global error handler translate into a clean `409 Conflict` — "this
slot was just taken, pick another." No locking, no read-then-write race window, no distributed
lock service needed. The partial filter means cancelled/leave-cancelled appointments don't count
toward the index, so a freed slot becomes bookable again immediately. Before attempting the write,
the API also re-validates the slot against the doctor's working hours and leave days
(`getAvailableSlots`), so a stale UI showing an old slot list still fails safely.

## Slot hold mechanism

Booking is a two-step flow, not a single atomic action, because the product requires a symptom
form *before* confirmation — and we don't want to block a slot indefinitely while a patient thinks.

1. **Hold** (`POST /appointments/hold`): creates an `Appointment` with `status: 'held'` and
   `holdExpiresAt = now + SLOT_HOLD_MINUTES`. This document participates in the unique index
   above, so it genuinely reserves the slot against other patients.
2. **Confirm** (`POST /appointments/:id/confirm`): the patient submits symptoms; the LLM
   generates the pre-visit summary; status flips to `confirmed`; `holdExpiresAt` is `$unset`.

Expiry is enforced two ways: (a) a MongoDB **TTL index** (`{holdExpiresAt: 1}, {expireAfterSeconds: 0}`)
physically deletes abandoned holds so the slot silently becomes available again with zero
application code, and (b) the confirm handler double-checks `holdExpiresAt < now` and returns
`410 Gone` if the hold already lapsed, closing the race where TTL cleanup (which MongoDB runs on
a ~60s background sweep) hasn't fired yet but the deadline has technically passed. Because
`$unset` removes the field entirely on confirmation, confirmed appointments are permanently
outside the TTL index's scope — they are never at risk of expiring.

## Doctor leave conflict handling

Leave is set at the `DoctorProfile` level (`leaveDays: [Date]`) by the admin. Two things happen
atomically in `addLeaveDay`:

1. The date is pushed into `leaveDays`, which immediately removes that date from
   `getAvailableSlots()`'s candidate generation for all future slot lookups — the date-level leave
   check runs before working-hours expansion, so it's a cheap early return.
2. The system queries existing `confirmed` appointments for that doctor/date, transitions each to
   `status: 'leave-cancelled'` (a distinct status from a normal `cancelled`, so downstream
   reporting and patient-facing UI can explain *why* — "doctor on leave" vs. "you cancelled"),
   deletes any associated Google Calendar events on both sides, and emails each affected patient
   with the reason. Each of these side effects is best-effort and independently wrapped — a failed
   calendar delete or email doesn't stop the others, and the leave day itself is already committed,
   so the admin's action always succeeds even if downstream notification infra is degraded. The
   API response includes a per-appointment notification receipt (`emailSent: true/false`) so the
   admin can see at a glance if anything needs manual follow-up.

## Notification failure handling

Both integrations (Brevo email, Google Calendar) are treated as **non-critical side effects** of
otherwise-successful state transitions, never as blocking dependencies:

- `emailService.sendEmail()` catches all Brevo errors internally and returns
  `{success, error}` instead of throwing. Every call site (`confirmBooking`, `cancelAppointment`,
  `completeVisit`, `addLeaveDay`) awaits it but only reads the boolean for reporting purposes —
  a booking is still confirmed, a visit still completed, even if the email provider is down.
- `calendarService` follows the identical pattern: `createEventForUser` /
  `updateEventForUser` / `deleteEventForUser` all catch and log internally, returning `null`/`false`
  on any failure (including a user who never connected their calendar in the first place — treated
  identically to a transient error). Refresh-token rotation is handled via the `googleapis`
  client's `tokens` event, persisted back onto the `User` document automatically.
- For durability beyond a single process lifetime, `jobs/reminderJob.js` maintains a small
  in-memory retry queue (max 3 attempts) that's drained on every cron tick, in addition to its
  primary job of sending 24-hour-ahead appointment reminders and prescription-duration-based
  medication reminders. This is explicitly called out in the README as a simplification: a
  production deployment should replace the in-memory queue with a persistent one (BullMQ/Agenda)
  backed by MongoDB or Redis so retries survive a restart and can be observed/alerted on.

*(~800 words)*

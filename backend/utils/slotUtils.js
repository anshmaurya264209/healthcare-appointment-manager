const Appointment = require('../models/Appointment');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function isDoctorOnLeave(doctorProfile, dateStr) {
  return doctorProfile.leaveDays.some((leaveDate) => {
    const d = new Date(leaveDate);
    const iso = d.toISOString().slice(0, 10);
    return iso === dateStr;
  });
}

/**
 * Generates all theoretical slots for a doctor on a given date based on working hours
 * and slot duration, then filters out slots already held/confirmed/completed and,
 * if the date is a leave day, returns an empty list.
 */
async function getAvailableSlots(doctorProfile, dateStr) {
  if (isDoctorOnLeave(doctorProfile, dateStr) || !doctorProfile.isAcceptingBookings) {
    return [];
  }

  const dayName = DAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
  const hoursForDay = doctorProfile.workingHours.filter((wh) => wh.day === dayName);
  if (hoursForDay.length === 0) return [];

  const duration = doctorProfile.slotDurationMinutes;
  const candidateSlots = [];

  hoursForDay.forEach((wh) => {
    let cursor = toMinutes(wh.start);
    const end = toMinutes(wh.end);
    while (cursor + duration <= end) {
      candidateSlots.push({ startTime: toHHMM(cursor), endTime: toHHMM(cursor + duration) });
      cursor += duration;
    }
  });

  // Slots already taken (held or confirmed/completed) for this doctor/date
  const taken = await Appointment.find({
    doctor: doctorProfile.user,
    date: dateStr,
    status: { $in: ['held', 'confirmed', 'completed', 'no-show'] },
  }).select('startTime -_id');

  const takenSet = new Set(taken.map((t) => t.startTime));

  return candidateSlots.filter((s) => !takenSet.has(s.startTime));
}

module.exports = { getAvailableSlots, isDoctorOnLeave, toMinutes, toHHMM, DAY_NAMES };

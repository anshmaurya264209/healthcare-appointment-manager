const mongoose = require('mongoose');

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true },
    dosage: { type: String, required: true }, // e.g. "500mg"
    frequency: { type: String, required: true }, // e.g. "3x/day" - drives reminder scheduling
    durationDays: { type: Number, required: true, default: 5 },
    instructions: { type: String, default: '' },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },

    date: { type: String, required: true }, // "YYYY-MM-DD" (doctor-local date)
    startTime: { type: String, required: true }, // "09:30"
    endTime: { type: String, required: true }, // "10:00"

    status: {
      type: String,
      enum: ['held', 'confirmed', 'cancelled', 'leave-cancelled', 'completed', 'no-show'],
      default: 'held',
      index: true,
    },

    // Slot hold: a temporary reservation created the moment a patient picks a slot,
    // released automatically via TTL index if not confirmed within SLOT_HOLD_MINUTES.
    holdExpiresAt: { type: Date, default: undefined },

    symptoms: { type: String, default: '' },

    preVisitSummary: {
      urgency: { type: String, enum: ['Low', 'Medium', 'High', null], default: null },
      chiefComplaint: { type: String, default: '' },
      suggestedQuestions: { type: [String], default: [] },
      raw: { type: String, default: '' },
      generatedAt: { type: Date },
      failed: { type: Boolean, default: false },
    },

    postVisitNotes: { type: String, default: '' },
    prescription: { type: [prescriptionItemSchema], default: [] },

    postVisitSummary: {
      summaryText: { type: String, default: '' },
      medicationSchedule: { type: String, default: '' },
      followUpSteps: { type: String, default: '' },
      raw: { type: String, default: '' },
      generatedAt: { type: Date },
      failed: { type: Boolean, default: false },
    },

    googleEvent: {
      patientEventId: { type: String, default: null },
      doctorEventId: { type: String, default: null },
    },

    cancellationReason: { type: String, default: '' },
    cancelledBy: { type: String, enum: ['patient', 'doctor', 'admin', 'system', null], default: null },
  },
  { timestamps: true }
);

// Prevent double-booking: only one non-cancelled appointment per doctor/date/startTime.
// Partial index excludes cancelled/leave-cancelled records so those slots can be rebooked.
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['held', 'confirmed', 'completed', 'no-show'] } },
  }
);

// TTL: documents are auto-deleted once holdExpiresAt passes, but ONLY while the field
// is set (confirmed appointments have holdExpiresAt unset via $unset, so TTL ignores them).
appointmentSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Appointment', appointmentSchema);

const mongoose = require('mongoose');

const workingHourSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      required: true,
    },
    start: { type: String, required: true }, // "09:00"
    end: { type: String, required: true }, // "17:00"
  },
  { _id: false }
);

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialization: { type: String, required: true, index: true },
    bio: { type: String, default: '' },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
    workingHours: { type: [workingHourSchema], default: [] },
    // Specific calendar dates the doctor is unavailable (full day leave)
    leaveDays: [{ type: Date }],
    consultationFee: { type: Number, default: 0 },
    isAcceptingBookings: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);

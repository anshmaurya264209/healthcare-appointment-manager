/**
 * Run once after setup: `npm run seed`
 * Creates a default admin account so you can log in and start creating doctor profiles.
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from env, or falls back to sensible defaults.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@clinic.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
  } else {
    await User.create({ name: 'Clinic Admin', email, password, role: 'admin' });
    console.log(`Admin created — email: ${email} password: ${password}`);
    console.log('Please change this password after first login.');
  }

  await mongoose.disconnect();
  process.exit(0);
})();

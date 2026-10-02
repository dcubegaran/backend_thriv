require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();

// CORS - allow local dev and tunnel origins while we fix the frontend host configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/website', require('./routes/website'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/terms', require('./routes/terms'));
app.use('/api/contract-types', require('./routes/contractTypes'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/personal-expenses', require('./routes/personalExpenses'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/agreements', require('./routes/agreements'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Error handler - never expose internals
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum 5 MB.' });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Connect to MongoDB and start
const PORT = process.env.PORT || 5000;

async function ensureInitialSuperadmin() {
  const email = process.env.SUPERADMIN_INIT_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPERADMIN_INIT_PASSWORD;

  if (!email || !password) {
    console.warn('Initial superadmin was not checked: SUPERADMIN_INIT_EMAIL or SUPERADMIN_INIT_PASSWORD is missing.');
    return;
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log(`Initial superadmin already exists: ${email}`);
    return;
  }

  await User.create({
    name: 'Superadmin',
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'superadmin',
  });
  console.log(`Initial superadmin created: ${email}`);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await ensureInitialSuperadmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

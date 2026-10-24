const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAttendance } = require('../controllers/attendanceController');

router.get('/', protect, getAttendance);

module.exports = router;

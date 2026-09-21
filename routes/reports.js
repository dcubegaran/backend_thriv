const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getReport } = require('../controllers/reportController');

router.get('/', protect, getReport);

module.exports = router;

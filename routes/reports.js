const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getReport, downloadTablePdf } = require('../controllers/reportController');

router.get('/', protect, getReport);
router.post('/table-pdf', protect, requireRole('superadmin', 'admin'), downloadTablePdf);

module.exports = router;

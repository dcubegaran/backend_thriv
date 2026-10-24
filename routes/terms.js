const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getTerms, updateTerms } = require('../controllers/termsController');

router.get('/', getTerms);
router.put('/', protect, requireRole('superadmin'), updateTerms);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getWebsite, getSection, updateSection } = require('../controllers/websiteController');

// Public: get all sections
router.get('/', getWebsite);
router.get('/:section', getSection);

// Superadmin: update
router.put('/:section', protect, requireRole('superadmin'), updateSection);

module.exports = router;

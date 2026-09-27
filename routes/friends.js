const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getFriends, createFriend } = require('../controllers/friendController');

// Admin only
router.use(protect, requireRole('admin'));
router.get('/', getFriends);
router.post('/', createFriend);

module.exports = router;

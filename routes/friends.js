const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getFriends, createFriend, deleteFriend } = require('../controllers/friendController');

// Admin only
router.use(protect, requireRole('admin'));
router.get('/', getFriends);
router.post('/', createFriend);
router.delete('/:id', deleteFriend);

module.exports = router;

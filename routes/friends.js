const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getFriends, getFriend, createFriend, deleteFriend, addEntry, deleteEntry,
} = require('../controllers/friendController');

// Admin only
router.use(protect, requireRole('admin'));
router.get('/', getFriends);
router.post('/', createFriend);
router.get('/:id', getFriend);
router.delete('/:id', deleteFriend);
router.post('/:id/entries', addEntry);
router.delete('/:id/entries/:entryId', deleteEntry);

module.exports = router;

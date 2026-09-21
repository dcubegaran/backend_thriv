const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getUsers, createUser, updatePassword, deleteUser, changeOwnPassword
} = require('../controllers/userController');

// Self password change must come BEFORE the superadmin-only middleware
router.put('/self/password', protect, changeOwnPassword);

// Supervisors list — accessible by admin and superadmin (for site assignment)
router.get('/supervisors', protect, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const supervisors = await User.find({ role: 'supervisor' }, '-passwordHash').sort({ name: 1 });
    res.json({ success: true, users: supervisors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get supervisors' });
  }
});

// All routes below require superadmin
router.use(protect, requireRole('superadmin'));
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id/password', updatePassword);
router.delete('/:id', deleteUser);

module.exports = router;

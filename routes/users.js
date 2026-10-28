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

// User list: admins (Users page) and superadmins (assigning users to a site)
router.get('/', protect, requireRole('superadmin', 'admin'), getUsers);

// User management is done by admins only (superadmins no longer have a Users page)
router.use(protect, requireRole('admin'));
router.post('/', createUser);
router.put('/:id/password', updatePassword);
router.delete('/:id', deleteUser);

module.exports = router;

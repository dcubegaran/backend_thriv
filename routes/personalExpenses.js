const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getPersonalExpenses, addPersonalExpense, deletePersonalExpense } = require('../controllers/personalExpenseController');

// All authenticated users can add
router.post('/', protect, addPersonalExpense);

// Only superadmin and admin can view history
router.get('/', protect, requireRole('superadmin', 'admin'), getPersonalExpenses);
router.delete('/:id', protect, requireRole('superadmin', 'admin'), deletePersonalExpense);

module.exports = router;

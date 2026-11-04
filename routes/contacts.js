const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getContacts, createCategory, deleteCategory, createContact, deleteContact,
} = require('../controllers/contactController');

// Admin only (like Friends)
router.use(protect, requireRole('admin'));
router.get('/', getContacts);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/', createContact);
router.delete('/:id', deleteContact);

module.exports = router;

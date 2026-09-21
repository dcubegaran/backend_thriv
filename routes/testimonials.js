const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial
} = require('../controllers/testimonialController');

router.get('/', getTestimonials);
router.post('/', protect, requireRole('superadmin'), createTestimonial);
router.put('/:id', protect, requireRole('superadmin'), updateTestimonial);
router.delete('/:id', protect, requireRole('superadmin'), deleteTestimonial);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getProjects, createProject, updateProject, deleteProject
} = require('../controllers/projectController');

// Public
router.get('/', getProjects);

// Superadmin
router.post('/', protect, requireRole('superadmin'), createProject);
router.put('/:id', protect, requireRole('superadmin'), updateProject);
router.delete('/:id', protect, requireRole('superadmin'), deleteProject);

module.exports = router;

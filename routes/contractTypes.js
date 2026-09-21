const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getContractTypes, createContractType, updateContractType
} = require('../controllers/contractTypeController');

router.get('/', protect, getContractTypes);
router.post('/', protect, requireRole('superadmin', 'admin', 'supervisor'), createContractType);
router.put('/:id', protect, requireRole('superadmin'), updateContractType);

module.exports = router;

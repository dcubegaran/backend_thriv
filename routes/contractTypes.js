const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getContractTypes, createContractType, updateContractType, deleteContractType
} = require('../controllers/contractTypeController');

router.get('/', protect, getContractTypes);
router.post('/', protect, requireRole('superadmin', 'admin', 'supervisor'), createContractType);
router.put('/:id', protect, requireRole('superadmin'), updateContractType);
router.delete('/:id', protect, requireRole('superadmin'), deleteContractType);

module.exports = router;

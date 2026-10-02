const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getAgreements, getAgreement, createAgreement, updateAgreement, deleteAgreement,
} = require('../controllers/agreementController');

// Admins and supervisors can view, create and edit agreements; only admins can delete
router.use(protect, requireRole('superadmin', 'admin', 'supervisor'));

router.get('/', getAgreements);
router.get('/:id', getAgreement);
router.post('/', createAgreement);
router.put('/:id', updateAgreement);
router.delete('/:id', requireRole('superadmin', 'admin'), deleteAgreement);

module.exports = router;

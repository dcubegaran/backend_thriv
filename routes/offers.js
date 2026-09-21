const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const optionalProtect = require('../middleware/optionalAuth');
const { getOffers, createOffer, updateOffer, deleteOffer } = require('../controllers/offerController');

router.get('/', optionalProtect, getOffers);
router.post('/', protect, requireRole('superadmin'), createOffer);
router.put('/:id', protect, requireRole('superadmin'), updateOffer);
router.delete('/:id', protect, requireRole('superadmin'), deleteOffer);

module.exports = router;

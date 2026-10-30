const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getCredits, createCredit, closeCredit, deleteCredit } = require('../controllers/creditController');

router.use(protect);
router.get('/', getCredits);
router.post('/', createCredit);
router.put('/:id/close', closeCredit);
router.delete('/:id', requireRole('superadmin', 'admin'), deleteCredit);

module.exports = router;

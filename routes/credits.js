const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getCredits, createCredit, closeCredit } = require('../controllers/creditController');

router.use(protect);
router.get('/', getCredits);
router.post('/', createCredit);
router.put('/:id/close', closeCredit);

module.exports = router;

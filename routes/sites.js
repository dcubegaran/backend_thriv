const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getSites, getSite, downloadSiteReport, createSite, updateSite,
  addLabour, getLabourLogs, updateLabourLog, addMaterial, getMaterialLogs,
  addUnexpectedCost, getUnexpectedCosts, addContract, getContracts
} = require('../controllers/siteController');

router.use(protect);

router.get('/', getSites);
router.post('/', requireRole('superadmin', 'admin', 'supervisor'), createSite);
router.get('/:id', getSite);
router.post('/:id/report-pdf', downloadSiteReport);
router.put('/:id', updateSite);

router.post('/:id/labour', addLabour);
router.get('/:id/labour', getLabourLogs);
router.put('/:id/labour/:logId', requireRole('superadmin', 'admin', 'supervisor'), updateLabourLog);

router.post('/:id/material', addMaterial);
router.get('/:id/material', getMaterialLogs);

router.post('/:id/unexpected-cost', addUnexpectedCost);
router.get('/:id/unexpected-cost', getUnexpectedCosts);

router.post('/:id/contracts', addContract);
router.get('/:id/contracts', getContracts);

module.exports = router;

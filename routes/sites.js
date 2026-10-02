const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getSites, getSite, downloadSiteReport, downloadTablePdf, createSite, updateSite, deleteSite, addValuation,
  addLabour, getLabourLogs, updateLabourLog, deleteLabourLog,
  addMaterial, getMaterialLogs, updateMaterialLog, deleteMaterialLog,
  addUnexpectedCost, getUnexpectedCosts, updateUnexpectedCost, deleteUnexpectedCost,
  addContract, getContracts, updateContract, deleteContract,
  addExtraExpense, getExtraExpenses, updateExtraExpense, deleteExtraExpense
} = require('../controllers/siteController');

// Entries: admins can edit and delete; supervisors can only delete entries dated this week (checked in the controller)
const canEdit = requireRole('superadmin', 'admin');
const canDelete = requireRole('superadmin', 'admin', 'supervisor');

router.use(protect);

router.get('/', getSites);
router.post('/', requireRole('superadmin', 'admin'), createSite);
router.get('/:id', getSite);
router.post('/:id/report-pdf', downloadSiteReport);
router.post('/:id/table-pdf', downloadTablePdf);
router.put('/:id', updateSite);
router.delete('/:id', requireRole('superadmin', 'admin'), deleteSite);
router.post('/:id/valuation', requireRole('superadmin', 'admin'), addValuation);

router.post('/:id/labour', addLabour);
router.get('/:id/labour', getLabourLogs);
router.put('/:id/labour/:entryId', canEdit, updateLabourLog);
router.delete('/:id/labour/:entryId', canDelete, deleteLabourLog);

router.post('/:id/material', addMaterial);
router.get('/:id/material', getMaterialLogs);
router.put('/:id/material/:entryId', canEdit, updateMaterialLog);
router.delete('/:id/material/:entryId', canDelete, deleteMaterialLog);

router.post('/:id/unexpected-cost', addUnexpectedCost);
router.get('/:id/unexpected-cost', getUnexpectedCosts);
router.put('/:id/unexpected-cost/:entryId', canEdit, updateUnexpectedCost);
router.delete('/:id/unexpected-cost/:entryId', canDelete, deleteUnexpectedCost);

router.post('/:id/contracts', addContract);
router.get('/:id/contracts', getContracts);
router.put('/:id/contracts/:entryId', canEdit, updateContract);
router.delete('/:id/contracts/:entryId', canDelete, deleteContract);

router.post('/:id/extra-expenses', addExtraExpense);
router.get('/:id/extra-expenses', getExtraExpenses);
router.put('/:id/extra-expenses/:entryId', canEdit, updateExtraExpense);
router.delete('/:id/extra-expenses/:entryId', canDelete, deleteExtraExpense);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getSites, getSite, downloadSiteReport, downloadTablePdf, createSite, updateSite, deleteSite, addValuation,
  addLabour, getLabourLogs, updateLabourPaid, updateLabourLog, deleteLabourLog,
  addMaterial, getMaterialLogs, updateMaterialLog, deleteMaterialLog,
  addUnexpectedCost, getUnexpectedCosts, updateUnexpectedCost, deleteUnexpectedCost,
  addContract, getContracts, markContractPaid, updateContract, deleteContract, deleteContractAttendanceWorker,
  addExtraExpense, getExtraExpenses, updateExtraExpense, deleteExtraExpense,
  addSiteNote, getSiteNotes, updateSiteNote, deleteSiteNote,
  getLabourAdvances, saveLabourAdvance,
  addSiteAttendance, getSiteAttendance, updateSiteAttendance, deleteSiteAttendance
} =require('../controllers/siteController');

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
router.patch('/:id/labour/paid', updateLabourPaid);
router.get('/:id/labour-advances', getLabourAdvances);
router.put('/:id/labour-advances', saveLabourAdvance);
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
router.patch('/:id/contracts/:entryId/paid', markContractPaid);
router.put('/:id/contracts/:entryId', canEdit, updateContract);
router.delete('/:id/contracts/:entryId', canDelete, deleteContract);
router.delete('/:id/contracts/:entryId/attendance/:workerId', canDelete, deleteContractAttendanceWorker);

router.post('/:id/extra-expenses', addExtraExpense);
router.get('/:id/extra-expenses', getExtraExpenses);
router.put('/:id/extra-expenses/:entryId', canEdit, updateExtraExpense);
router.delete('/:id/extra-expenses/:entryId', canDelete, deleteExtraExpense);

router.post('/:id/notes', addSiteNote);
router.get('/:id/notes', getSiteNotes);
router.put('/:id/notes/:entryId', canEdit, updateSiteNote);
router.delete('/:id/notes/:entryId', canDelete, deleteSiteNote);

// Attendance only (no advance / rate / salary)
router.post('/:id/attendance', addSiteAttendance);
router.get('/:id/attendance', getSiteAttendance);
router.put('/:id/attendance/:entryId', canEdit, updateSiteAttendance);
router.delete('/:id/attendance/:entryId', canDelete, deleteSiteAttendance);

module.exports = router;

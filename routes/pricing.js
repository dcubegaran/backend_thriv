const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getLabourTypes, createLabourType, updateLabourType, deleteLabourType,
  getWorkers, createWorker, updateWorker, deleteWorker,
  getSqftPricing, createSqftPricing, updateSqftPricing, deleteSqftPricing,
  getMaterials, createMaterial, updateMaterial, deleteMaterial,
  getLabourContracts, createLabourContract, updateLabourContract, deleteLabourContract,
  getLabourContractWorkers, createLabourContractWorker, updateLabourContractWorker, deleteLabourContractWorker,
} = require('../controllers/pricingController');

// Labour types
router.get('/labour', protect, getLabourTypes);
router.post('/labour', protect, requireRole('superadmin'), createLabourType);
router.put('/labour/:id', protect, requireRole('superadmin'), updateLabourType);
router.delete('/labour/:id', protect, requireRole('superadmin'), deleteLabourType);

// Workers - accessible by all roles that manage sites
router.get('/workers', protect, getWorkers);
router.post('/workers', protect, requireRole('superadmin', 'admin', 'supervisor'), createWorker);
router.put('/workers/:id', protect, requireRole('superadmin', 'admin', 'supervisor'), updateWorker);
router.delete('/workers/:id', protect, requireRole('superadmin'), deleteWorker);

// Sqft pricing
router.get('/sqft', getSqftPricing);
router.post('/sqft', protect, requireRole('superadmin'), createSqftPricing);
router.put('/sqft/:id', protect, requireRole('superadmin'), updateSqftPricing);
router.delete('/sqft/:id', protect, requireRole('superadmin'), deleteSqftPricing);

// Materials
router.get('/materials', protect, getMaterials);
router.post('/materials', protect, requireRole('superadmin'), createMaterial);
router.put('/materials/:id', protect, requireRole('superadmin'), updateMaterial);
router.delete('/materials/:id', protect, requireRole('superadmin'), deleteMaterial);

// Labour contracts and their workers (same access as labour types / workers)
router.get('/labour-contracts', protect, getLabourContracts);
router.post('/labour-contracts', protect, requireRole('superadmin'), createLabourContract);
router.put('/labour-contracts/:id', protect, requireRole('superadmin'), updateLabourContract);
router.delete('/labour-contracts/:id', protect, requireRole('superadmin'), deleteLabourContract);
router.get('/labour-contract-workers', protect, getLabourContractWorkers);
router.post('/labour-contract-workers', protect, requireRole('superadmin', 'admin', 'supervisor'), createLabourContractWorker);
router.put('/labour-contract-workers/:id', protect, requireRole('superadmin', 'admin', 'supervisor'), updateLabourContractWorker);
router.delete('/labour-contract-workers/:id', protect, requireRole('superadmin'), deleteLabourContractWorker);

module.exports = router;

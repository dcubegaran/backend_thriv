const LabourType = require('../models/LabourType');
const Worker = require('../models/Worker');
const SqftPricing = require('../models/SqftPricing');
const Material = require('../models/Material');
const { isValidObjectId } = require('../utils/validate');

// ---- Labour Types ----

exports.getLabourTypes = async (req, res) => {
  try {
    const types = await LabourType.find({}).sort({ name: 1 });
    res.json({ success: true, labourTypes: types });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get labour types' });
  }
};

exports.createLabourType = async (req, res) => {
  try {
    const { name, ratePerDay } = req.body;
    if (!name || ratePerDay === undefined || ratePerDay === null) {
      return res.status(400).json({ success: false, message: 'Name and rate required' });
    }
    if (isNaN(ratePerDay) || ratePerDay < 0) {
      return res.status(400).json({ success: false, message: 'Rate must be a non-negative number' });
    }
    const lt = await LabourType.create({ name, ratePerDay: Number(ratePerDay) });
    res.status(201).json({ success: true, labourType: lt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create labour type' });
  }
};

exports.updateLabourType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const { name, ratePerDay, active } = req.body;
    const lt = await LabourType.findByIdAndUpdate(req.params.id, { name, ratePerDay, active }, { new: true });
    if (!lt) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, labourType: lt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update labour type' });
  }
};

// ---- Workers ----

exports.getWorkers = async (req, res) => {
  try {
    const query = req.query.labourTypeId ? { labourTypeId: req.query.labourTypeId } : {};
    const workers = await Worker.find(query).populate('labourTypeId', 'name ratePerDay').sort({ name: 1 });
    res.json({ success: true, workers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get workers' });
  }
};

exports.createWorker = async (req, res) => {
  try {
    const { name, labourTypeId } = req.body;
    if (!name || !labourTypeId) {
      return res.status(400).json({ success: false, message: 'Name and labour type required' });
    }
    if (!isValidObjectId(labourTypeId)) {
      return res.status(400).json({ success: false, message: 'Invalid labour type ID' });
    }
    const labourType = await LabourType.findById(labourTypeId);
    if (!labourType) {
      return res.status(404).json({ success: false, message: 'Labour type not found' });
    }
    const worker = await Worker.create({ name, labourTypeId });
    res.status(201).json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create worker' });
  }
};

exports.updateWorker = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update worker' });
  }
};

// ---- Sqft Pricing ----

exports.getSqftPricing = async (req, res) => {
  try {
    const pricing = await SqftPricing.find({}).sort({ createdAt: -1 });
    res.json({ success: true, sqftPricing: pricing });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get sqft pricing' });
  }
};

exports.createSqftPricing = async (req, res) => {
  try {
    const { label, ratePerSqft, minSqft, maxSqft } = req.body;
    if (!label || ratePerSqft === undefined) {
      return res.status(400).json({ success: false, message: 'Label and rate required' });
    }
    if (isNaN(ratePerSqft) || ratePerSqft < 0) {
      return res.status(400).json({ success: false, message: 'Rate must be a non-negative number' });
    }

    const min = Number(minSqft ?? 0);
    const max = Number(maxSqft ?? 0);
    const existing = await SqftPricing.find({ active: true });
    const overlaps = existing.some(item => {
      const itemMin = Number(item.minSqft ?? 0);
      const itemMax = Number(item.maxSqft ?? Number.MAX_SAFE_INTEGER);
      if (max > 0 && itemMax > 0) {
        return !(max < itemMin || min > itemMax) || !(itemMax < min || max < itemMin);
      }
      return false;
    });
    if (overlaps) {
      return res.status(400).json({ success: false, message: 'This sqft range overlaps an existing range. Edit the available ranges instead.' });
    }

    const p = await SqftPricing.create({
      label,
      ratePerSqft: Number(ratePerSqft),
      minSqft: Number.isFinite(min) ? min : 0,
      maxSqft: Number.isFinite(max) && max > 0 ? max : undefined,
    });
    res.status(201).json({ success: true, sqftPricing: p });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create sqft pricing' });
  }
};

exports.updateSqftPricing = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const p = await SqftPricing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, sqftPricing: p });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update sqft pricing' });
  }
};

exports.deleteSqftPricing = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    await SqftPricing.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete sqft pricing' });
  }
};

// ---- Materials ----

exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find({}).sort({ name: 1 });
    res.json({ success: true, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get materials' });
  }
};

exports.createMaterial = async (req, res) => {
  try {
    const { name, units } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name required' });
    }
    const material = await Material.create({ name, units: units || [] });
    res.status(201).json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create material' });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const material = await Material.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update material' });
  }
};

const LabourType = require('../models/LabourType');
const Worker = require('../models/Worker');
const SqftPricing = require('../models/SqftPricing');
const Material = require('../models/Material');
const { isValidObjectId, sameNameRegex } = require('../utils/validate');

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
    const { ratePerDay } = req.body;
    const name = String(req.body.name || '').trim();
    if (!name || ratePerDay === undefined || ratePerDay === null || ratePerDay === '') {
      return res.status(400).json({ success: false, message: 'Name and rate required' });
    }
    if (isNaN(ratePerDay) || ratePerDay < 0) {
      return res.status(400).json({ success: false, message: 'Rate must be a non-negative number' });
    }
    if (await LabourType.exists({ name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A labour type with this name already exists' });
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
    const { ratePerDay } = req.body;
    const name = String(req.body.name || '').trim();
    if (!name || ratePerDay === undefined || ratePerDay === null || ratePerDay === '' || isNaN(ratePerDay) || ratePerDay < 0) {
      return res.status(400).json({ success: false, message: 'Name and a non-negative rate required' });
    }
    if (await LabourType.exists({ _id: { $ne: req.params.id }, name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A labour type with this name already exists' });
    }
    const lt = await LabourType.findByIdAndUpdate(req.params.id, { name, ratePerDay: Number(ratePerDay) }, { new: true });
    if (!lt) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, labourType: lt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update labour type' });
  }
};

// Deletes the labour type and its workers. Past labour logs keep their name/rate snapshots.
exports.deleteLabourType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const lt = await LabourType.findByIdAndDelete(req.params.id);
    if (!lt) return res.status(404).json({ success: false, message: 'Not found' });
    await Worker.deleteMany({ labourTypeId: lt._id });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete labour type' });
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
    const { labourTypeId } = req.body;
    const name = String(req.body.name || '').trim();
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
    if (await Worker.exists({ labourTypeId, name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A worker with this name already exists for this labour type' });
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
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    if (await Worker.exists({ _id: { $ne: worker._id }, labourTypeId: worker.labourTypeId, name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A worker with this name already exists for this labour type' });
    }
    worker.name = name;
    await worker.save();
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update worker' });
  }
};

// Past labour logs keep the worker name snapshot
exports.deleteWorker = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const worker = await Worker.findByIdAndDelete(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete worker' });
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

    if (await SqftPricing.exists({ label: sameNameRegex(label) })) {
      return res.status(400).json({ success: false, message: 'A pricing range with this label already exists' });
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

// A material is saved with one unit and its price: body { name, unit, price }
const readMaterialBody = (body) => {
  const name = String(body.name || '').trim();
  const unit = String(body.unit || '').trim();
  const { price } = body;
  if (!name || !unit || price === undefined || price === null || price === '') {
    return { error: 'Name, unit and price required' };
  }
  if (isNaN(price) || Number(price) < 0) {
    return { error: 'Price must be a non-negative number' };
  }
  return { name, unit, price: Number(price) };
};

exports.createMaterial = async (req, res) => {
  try {
    const { error, name, unit, price } = readMaterialBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (await Material.exists({ name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A material with this name already exists' });
    }
    const material = await Material.create({ name, units: [{ unitName: unit, ratePerUnit: price }] });
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
    const { error, name, unit, price } = readMaterialBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    if (await Material.exists({ _id: { $ne: material._id }, name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A material with this name already exists' });
    }
    material.name = name;
    // Older materials may have several units: the edited one is the first, the others are kept
    material.units = [{ unitName: unit, ratePerUnit: price }, ...(material.units || []).slice(1)];
    await material.save();
    res.json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update material' });
  }
};

// Past material logs keep their name/unit/rate snapshots
exports.deleteMaterial = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete material' });
  }
};

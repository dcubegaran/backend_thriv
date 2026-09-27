const ContractType = require('../models/ContractType');
const { isValidObjectId, sameNameRegex } = require('../utils/validate');

exports.getContractTypes = async (req, res) => {
  try {
    const types = await ContractType.find({}).sort({ name: 1 });
    res.json({ success: true, contractTypes: types });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get contract types' });
  }
};

exports.createContractType = async (req, res) => {
  try {
    const { defaultPrice } = req.body;
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name required' });
    }
    if (await ContractType.exists({ name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'A contract type with this name already exists' });
    }
    const ct = await ContractType.create({ name, defaultPrice: Number(defaultPrice) || 0 });
    res.status(201).json({ success: true, contractType: ct });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create contract type' });
  }
};

exports.updateContractType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    if (req.body.name !== undefined) {
      req.body.name = String(req.body.name).trim();
      if (!req.body.name) return res.status(400).json({ success: false, message: 'Name required' });
      if (await ContractType.exists({ _id: { $ne: req.params.id }, name: sameNameRegex(req.body.name) })) {
        return res.status(400).json({ success: false, message: 'A contract type with this name already exists' });
      }
    }
    const { name, defaultPrice } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = req.body.name;
    if (defaultPrice !== undefined) updates.defaultPrice = Number(defaultPrice) || 0;
    const ct = await ContractType.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ct) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, contractType: ct });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update contract type' });
  }
};

// DELETE /api/contract-types/:id - past site contracts keep their name/price snapshot
exports.deleteContractType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const ct = await ContractType.findByIdAndDelete(req.params.id);
    if (!ct) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete contract type' });
  }
};

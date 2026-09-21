const ContractType = require('../models/ContractType');
const { isValidObjectId } = require('../utils/validate');

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
    const { name, defaultPrice } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name required' });
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
    const ct = await ContractType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ct) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, contractType: ct });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update contract type' });
  }
};

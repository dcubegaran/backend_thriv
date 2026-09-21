const mongoose = require('mongoose');

const contractTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  defaultPrice: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ContractType', contractTypeSchema);

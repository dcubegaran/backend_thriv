const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitName: { type: String, required: true, trim: true },
  ratePerUnit: { type: Number, required: true, min: 0 },
}, { _id: true });

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  units: [unitSchema],
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);

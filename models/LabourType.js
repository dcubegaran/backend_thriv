const mongoose = require('mongoose');

const labourTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ratePerDay: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('LabourType', labourTypeSchema);

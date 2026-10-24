const mongoose = require('mongoose');

const labourTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ratePerDay: { type: Number, required: true, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('LabourType', labourTypeSchema);

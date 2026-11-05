const mongoose = require('mongoose');

// Labour Contract group in Pricing: like a labour type (rate per day; older ones may have none)
const labourContractSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ratePerDay: { type: Number, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('LabourContract', labourContractSchema);

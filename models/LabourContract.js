const mongoose = require('mongoose');

// Labour Contract group in Pricing: like a labour type, but without a rate
const labourContractSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('LabourContract', labourContractSchema);

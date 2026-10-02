const mongoose = require('mongoose');

const siteContractSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  contractTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractType' },
  contractTypeNameSnapshot: { type: String, required: true },
  priceAtTime: { type: Number, required: true, min: 0 },
  remarks: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteContractSchema.index({ siteId: 1 });

module.exports = mongoose.model('SiteContract', siteContractSchema);

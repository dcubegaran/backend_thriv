const mongoose = require('mongoose');

const unexpectedCostSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  name: { type: String, required: true, trim: true },
  remarks: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

unexpectedCostSchema.index({ siteId: 1 });

module.exports = mongoose.model('UnexpectedCost', unexpectedCostSchema);

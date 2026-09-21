const mongoose = require('mongoose');

const materialLogSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  date: { type: Date, required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  materialNameSnapshot: { type: String, required: true },
  unit: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  rateAtTime: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  remarks: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

materialLogSchema.index({ siteId: 1 });
materialLogSchema.index({ date: 1 });
materialLogSchema.index({ siteId: 1, date: 1 });

module.exports = mongoose.model('MaterialLog', materialLogSchema);

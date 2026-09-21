const mongoose = require('mongoose');

const labourLogSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  date: { type: Date, required: true },
  labourTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourType', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  workerNameSnapshot: { type: String, required: true },
  labourTypeNameSnapshot: { type: String, required: true },
  days: { type: Number, required: true, min: 0.5 },
  rateAtTime: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  advancePaid: { type: Number, default: 0, min: 0 },
  paid: { type: Boolean, default: false },
  remarks: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

labourLogSchema.index({ siteId: 1 });
labourLogSchema.index({ date: 1 });
labourLogSchema.index({ siteId: 1, date: 1 });

module.exports = mongoose.model('LabourLog', labourLogSchema);

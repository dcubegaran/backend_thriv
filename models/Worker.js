const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  labourTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourType', required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Worker', workerSchema);

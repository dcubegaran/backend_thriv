const mongoose = require('mongoose');

const labourContractWorkerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  labourContractId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourContract', required: true },
}, { timestamps: true });

module.exports = mongoose.model('LabourContractWorker', labourContractWorkerSchema);

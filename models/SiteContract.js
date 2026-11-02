const mongoose = require('mongoose');

// Labour Contract Attendance: which workers of a labour contract (Pricing) worked on this contract
const labourAttendanceSchema = new mongoose.Schema({
  labourContractId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourContract', required: true },
  labourContractName: { type: String, required: true },
  workers: [{
    _id: false,
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourContractWorker', required: true },
    name: { type: String, required: true },
    remarks: { type: String, default: '' },
  }],
}, { _id: false });

const siteContractSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  contractTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractType' },
  contractTypeNameSnapshot: { type: String, required: true },
  priceAtTime: { type: Number, min: 0 },
  advanceAtTime: { type: Number, min: 0 },
  paid: { type: Boolean, default: false },
  remarks: { type: String, default: '' },
  labourAttendance: { type: labourAttendanceSchema, default: undefined },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteContractSchema.index({ siteId: 1 });

siteContractSchema.pre('validate', function () {
  const hasPrice = this.priceAtTime !== undefined && this.priceAtTime !== null;
  const hasAdvance = this.advanceAtTime !== undefined && this.advanceAtTime !== null;
  if (hasPrice === hasAdvance) {
    this.invalidate('priceAtTime', 'Enter either a contract price or an advance, not both');
  }
  if (hasAdvance && this.advanceAtTime <= 0) {
    this.invalidate('advanceAtTime', 'Advance must be greater than zero');
  }
});

module.exports = mongoose.model('SiteContract', siteContractSchema);

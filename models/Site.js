const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  siteName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  ownerPhone: { type: String, required: true, trim: true },
  sqft: { type: Number, default: 0 },
  totalValuation: { type: Number, required: true, min: 0 },
  amountReceived: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  assignedAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assignedSupervisors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteSchema.index({ status: 1 });
siteSchema.index({ assignedAdmins: 1 });
siteSchema.index({ assignedSupervisors: 1 });

module.exports = mongoose.model('Site', siteSchema);

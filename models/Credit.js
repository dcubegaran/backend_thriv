const mongoose = require('mongoose');

const creditSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  shopName: { type: String, required: true, trim: true },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  closedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

creditSchema.index({ siteId: 1 });

module.exports = mongoose.model('Credit', creditSchema);

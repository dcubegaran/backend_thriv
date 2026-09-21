const mongoose = require('mongoose');

const quoteRequestSchema = new mongoose.Schema({
  quoteNumber: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  sqft: { type: Number, required: true, min: 1 },
  phone: { type: String, required: true, trim: true },
  remarks: { type: String, default: '' },
  estimatedAmount: { type: Number, default: 0 },
  source: {
    type: String,
    enum: ['website', 'manual'],
    default: 'website',
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Site Visit', 'Quotation Sent', 'Converted', 'Rejected', 'Closed'],
    default: 'New',
  },
}, { timestamps: true });

quoteRequestSchema.index({ quoteNumber: 1 });
quoteRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QuoteRequest', quoteRequestSchema);

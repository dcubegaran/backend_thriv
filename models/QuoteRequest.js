const mongoose = require('mongoose');

const quoteRequestSchema = new mongoose.Schema({
  quoteNumber: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  sqft: { type: Number, required: true, min: 1 },
  phone: { type: String, required: true, trim: true },
  remarks: { type: String, default: '' },
  estimatedAmount: { type: Number, default: 0 },
  // Offers the customer picked on the website, with the discount each one gave
  offersApplied: [{
    _id: false,
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    titleEn: String,
    titleTa: String,
    discountType: String,
    discountValue: Number,
    discountApplied: Number,
  }],
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

const mongoose = require('mongoose');

const appliedOfferSchema = new mongoose.Schema({
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  titleEn: String,
  titleTa: String,
  discountType: String,
  discountValue: Number,
  discountApplied: Number, // actual monetary discount applied
}, { _id: false });

const generatedQuoteSchema = new mongoose.Schema({
  quoteNumber: { type: String, unique: true },
  quoteRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuoteRequest', required: true },
  // Customer snapshots
  customerName: { type: String, required: true },
  customerCity: { type: String, required: true },
  customerPhone: { type: String, required: true },
  sqft: { type: Number, required: true },
  sqftRateAtGeneration: { type: Number, required: true },
  baseAmount: { type: Number, required: true },
  offersApplied: [appliedOfferSchema],
  finalAmount: { type: Number, required: true },
  termsAtGeneration: { type: String, default: '' },
  language: { type: String, enum: ['en', 'ta'], default: 'en' },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quoteType: { type: String, enum: ['public', 'internal'], default: 'internal' },
}, { timestamps: true });

generatedQuoteSchema.index({ quoteNumber: 1 });
generatedQuoteSchema.index({ quoteRequestId: 1 });
generatedQuoteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GeneratedQuote', generatedQuoteSchema);

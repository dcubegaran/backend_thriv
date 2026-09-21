const mongoose = require('mongoose');

// Construction sqft pricing (public quote pricing)
const sqftPricingSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  minSqft: { type: Number, default: 0, min: 0 },
  maxSqft: { type: Number, min: 0 },
  ratePerSqft: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SqftPricing', sqftPricingSchema);

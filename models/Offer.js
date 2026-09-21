const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  titleEn: { type: String, required: true, trim: true },
  titleTa: { type: String, default: '' },
  descriptionEn: { type: String, default: '' },
  descriptionTa: { type: String, default: '' },
  photo: { type: String, default: '' },
  photos: { type: [String], default: [] },
  discountType: { type: String, enum: ['none', 'fixed', 'percentage'], default: 'none' },
  discountValue: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);

const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  textEn: { type: String, required: true },
  textTa: { type: String, default: '' },
  photo: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);

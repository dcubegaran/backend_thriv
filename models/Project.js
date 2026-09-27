const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  sqft: { type: Number },
  descriptionEn: { type: String, default: '' },
  descriptionTa: { type: String, default: '' },
  photos: [{ type: String }],        // cover photos (the first is shown on the website card)
  gallery: [{ type: String }],       // extra photos shown in the project's View popup
  yearOfCompletion: { type: String, default: '', trim: true },
  units: { type: String, default: '', trim: true },
  completed: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

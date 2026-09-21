const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  sqft: { type: Number },
  descriptionEn: { type: String, default: '' },
  descriptionTa: { type: String, default: '' },
  photos: [{ type: String }],
  completed: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

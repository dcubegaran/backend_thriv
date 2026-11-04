const mongoose = require('mongoose');

// Contacts > a person in a category
const contactSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactCategory', required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  remarks: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

contactSchema.index({ categoryId: 1, name: 1 });

module.exports = mongoose.model('Contact', contactSchema);

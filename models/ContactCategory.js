const mongoose = require('mongoose');

// Contacts > a category (e.g. Electricians, Suppliers) holding contacts
const contactCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

contactCategorySchema.index({ name: 1 });

module.exports = mongoose.model('ContactCategory', contactCategorySchema);

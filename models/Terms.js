const mongoose = require('mongoose');

const termsSchema = new mongoose.Schema({
  textEn: { type: String, default: '' },
  textTa: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Terms', termsSchema);

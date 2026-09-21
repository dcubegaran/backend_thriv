const mongoose = require('mongoose');

const websiteContentSchema = new mongoose.Schema({
  section: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('WebsiteContent', websiteContentSchema);

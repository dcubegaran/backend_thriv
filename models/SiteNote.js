const mongoose = require('mongoose');

// A dated note on a site (title + plain-text content), shared by everyone on the site
const siteNoteSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  title: { type: String, default: '', trim: true, maxlength: 200 },
  content: { type: String, default: '', maxlength: 20000 },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteNoteSchema.index({ siteId: 1 });

module.exports = mongoose.model('SiteNote', siteNoteSchema);

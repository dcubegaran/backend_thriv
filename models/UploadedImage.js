const mongoose = require('mongoose');

// Uploaded images are kept in the database, not on the server's disk: the hosting (Render)
// wipes its disk on every restart / deploy, which deleted photos soon after they were uploaded.
// Served at /uploads/db/:id (max 5 MB each, well under MongoDB's 16 MB document limit).
const uploadedImageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  originalName: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('UploadedImage', uploadedImageSchema);

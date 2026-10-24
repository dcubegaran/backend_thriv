const mongoose = require('mongoose');

const letterPadSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  data: { type: Buffer, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

letterPadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LetterPad', letterPadSchema);

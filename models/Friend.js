const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

friendSchema.index({ name: 1, city: 1 });

module.exports = mongoose.model('Friend', friendSchema);

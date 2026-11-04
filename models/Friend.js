const mongoose = require('mongoose');

// Money is kept as Spent / Received entries (FriendEntry).
// amount / reason / date are from before entries: moved into a Spent entry when friends are loaded.
const friendSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  reason: { type: String, trim: true },
  amount: { type: Number, min: 0 },
  date: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

friendSchema.index({ name: 1, city: 1 });

module.exports = mongoose.model('Friend', friendSchema);

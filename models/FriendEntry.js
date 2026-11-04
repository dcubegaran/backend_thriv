const mongoose = require('mongoose');

// Friends > money spent on (given to) or received from a friend
const friendEntrySchema = new mongoose.Schema({
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friend', required: true },
  type: { type: String, enum: ['spent', 'received'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true, default: '' },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

friendEntrySchema.index({ friendId: 1, date: -1 });

module.exports = mongoose.model('FriendEntry', friendEntrySchema);

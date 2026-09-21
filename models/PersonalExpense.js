const mongoose = require('mongoose');

const personalExpenseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  reason: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

personalExpenseSchema.index({ addedBy: 1 });
personalExpenseSchema.index({ date: 1 });

module.exports = mongoose.model('PersonalExpense', personalExpenseSchema);

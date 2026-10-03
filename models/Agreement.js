const mongoose = require('mongoose');

// A written agreement laid out like the printed contract: title, opening paragraphs,
// numbered work clauses, closing paragraph, witnesses and a payment schedule.
// All wording is typed by the user; `language` only picks the fixed labels (party / witness labels, "Rs.").
const paymentSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  amount: { type: Number, default: null, min: 0 }, // empty -> the row prints as a plain note
}, { _id: false });

// Free-text section: printed exactly as typed / pasted (line breaks and spacing kept)
const sectionSchema = new mongoose.Schema({
  heading: { type: String }, // bold heading printed above the section (e.g. "கட்டிட வேலை விளக்கம் :")
  text: { type: String, default: '' },
  newPage: { type: Boolean, default: false }, // start this section on a new page
}, { _id: false });

const agreementSchema = new mongoose.Schema({
  language: { type: String, enum: ['en', 'ta'], default: 'ta' },
  title: { type: String, default: '', trim: true },
  // Current editor: up to three free-text sections. The structured fields below are kept
  // for agreements saved before; they are used only when no section has text.
  sections: { type: [sectionSchema], default: undefined },
  intro: { type: [String], default: [] },
  workHeading: { type: String, default: '' },
  clauses: { type: [String], default: [] },
  closing: { type: String, default: '' },
  witnesses: { type: [String], default: ['', ''] },
  paymentHeading: { type: String, default: '' },
  payments: { type: [paymentSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

agreementSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Agreement', agreementSchema);

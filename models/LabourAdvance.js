const mongoose = require('mongoose');

// Total advance given to one worker (worker + labour type) for one Monday–Sunday week on a site.
// Entered in Weekly Attendance; replaces the per-day advances of that worker's entries in that week.
const labourAdvanceSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  workerKey: { type: String, required: true, maxlength: 200 }, // "<workerId>-<labourTypeId>", as in Weekly Attendance
  weekStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // Monday, YYYY-MM-DD
  amount: { type: Number, required: true, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

labourAdvanceSchema.index({ siteId: 1, workerKey: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('LabourAdvance', labourAdvanceSchema);

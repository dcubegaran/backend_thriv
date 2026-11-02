const mongoose = require('mongoose');

// Attendance marked from Add Labour with "Attendance only" turned on: who was present on a day,
// with no advance, rate or salary (it never changes the site's money totals).
// Not the Attendance model, which mirrors labour entries.
const siteAttendanceSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  date: { type: Date, required: true },
  labourTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourType', required: true },
  labourTypeNameSnapshot: { type: String, required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  workerNameSnapshot: { type: String, required: true },
  remarks: { type: String, default: '', maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteAttendanceSchema.index({ siteId: 1, date: -1 });

module.exports = mongoose.model('SiteAttendance', siteAttendanceSchema);

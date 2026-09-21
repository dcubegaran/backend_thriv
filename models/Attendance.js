const mongoose = require('mongoose');

// Attendance is derived from labour logs - this model caches it
const attendanceSchema = new mongoose.Schema({
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  workerNameSnapshot: { type: String, required: true },
  labourTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourType', required: true },
  labourTypeNameSnapshot: { type: String, required: true },
  date: { type: Date, required: true },
  labourLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourLog', required: true },
}, { timestamps: true });

attendanceSchema.index({ date: 1 });
attendanceSchema.index({ workerId: 1 });
attendanceSchema.index({ siteId: 1 });
// Prevent duplicate attendance for same worker+site+date from same labour log
attendanceSchema.index({ labourLogId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

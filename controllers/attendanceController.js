const Attendance = require('../models/Attendance');
const { isValidObjectId } = require('../utils/validate');

// GET /api/attendance
exports.getAttendance = async (req, res) => {
  try {
    const { siteId, workerId, labourTypeId, date, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = {};

    if (siteId) {
      if (!isValidObjectId(siteId)) return res.status(400).json({ success: false, message: 'Invalid site ID' });
      query.siteId = siteId;
    }
    if (workerId) {
      if (!isValidObjectId(workerId)) return res.status(400).json({ success: false, message: 'Invalid worker ID' });
      query.workerId = workerId;
    }
    if (labourTypeId) {
      if (!isValidObjectId(labourTypeId)) return res.status(400).json({ success: false, message: 'Invalid labour type ID' });
      query.labourTypeId = labourTypeId;
    }
    if (date) {
      const d = new Date(date);
      query.date = { $gte: new Date(d.setHours(0,0,0,0)), $lte: new Date(d.setHours(23,59,59,999)) };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('siteId', 'siteName location')
      .populate('workerId', 'name')
      .populate('labourTypeId', 'name')
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, attendance: records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get attendance' });
  }
};

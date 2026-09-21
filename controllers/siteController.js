const Site = require('../models/Site');
const LabourLog = require('../models/LabourLog');
const MaterialLog = require('../models/MaterialLog');
const UnexpectedCost = require('../models/UnexpectedCost');
const SiteContract = require('../models/SiteContract');
const Attendance = require('../models/Attendance');
const LabourType = require('../models/LabourType');
const Worker = require('../models/Worker');
const Credit = require('../models/Credit');
const Material = require('../models/Material');
const ContractType = require('../models/ContractType');
const User = require('../models/User');
const { isValidObjectId } = require('../utils/validate');
const { generateSiteReportPDF } = require('../utils/siteReportPdf');
const {
  calcLabourTotal, calcMaterialTotal, calcCurrentSpend,
  calcRemainingAmount, calcRemainingBudget, calcSiteProfit, shouldShowWarning
} = require('../utils/calculations');

// Helper: check if user can access site
// Handles both populated User objects and raw ObjectIds in the assigned arrays
function canAccessSite(user, site) {
  if (user.role === 'superadmin') return true;
  const userId = user._id.toString();
  if (user.role === 'admin') {
    return site.assignedAdmins.some(entry => {
      const id = entry._id || entry;
      return id.toString() === userId;
    });
  }
  if (user.role === 'supervisor') {
    return site.assignedSupervisors.some(entry => {
      const id = entry._id || entry;
      return id.toString() === userId;
    });
  }
  return false;
}

// Compute spend totals for a site
async function getSiteSpend(siteId) {
  const [labourLogs, materialLogs, unexpectedCosts] = await Promise.all([
    LabourLog.find({ siteId }),
    MaterialLog.find({ siteId }),
    UnexpectedCost.find({ siteId }),
  ]);
  const labourTotal = labourLogs.reduce((sum, l) => sum + l.totalAmount, 0);
  const materialTotal = materialLogs.reduce((sum, m) => sum + m.totalAmount, 0);
  const unexpectedTotal = unexpectedCosts.reduce((sum, u) => sum + u.amount, 0);
  return {
    labourTotal,
    materialTotal,
    unexpectedTotal,
    currentSpend: calcCurrentSpend(labourTotal, materialTotal, unexpectedTotal),
  };
}

// GET /api/sites
exports.getSites = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      query = { assignedAdmins: req.user._id };
    } else if (req.user.role === 'supervisor') {
      query = { assignedSupervisors: req.user._id };
    }
    const sites = await Site.find(query)
      .populate('assignedAdmins', 'name email')
      .populate('assignedSupervisors', 'name email')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(sites.map(async (site) => {
      const s = site.toObject();
      const spend = await getSiteSpend(site._id);
      s.currentSpend = spend.currentSpend;
      if (req.user.role !== 'supervisor') {
        s.remainingAmount = calcRemainingAmount(site.totalValuation, site.amountReceived);
        s.remainingBudget = calcRemainingBudget(site.totalValuation, spend.currentSpend);
        s.warning = shouldShowWarning(s.remainingAmount);
        s.profit = site.status === 'closed' ? calcSiteProfit(site.totalValuation, spend.currentSpend) : null;
      }
      return s;
    }));

    res.json({ success: true, sites: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get sites' });
  }
};

// GET /api/sites/:id
exports.getSite = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id)
      .populate('assignedAdmins', 'name email')
      .populate('assignedSupervisors', 'name email');
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const s = site.toObject();
    const spend = await getSiteSpend(site._id);
    s.currentSpend = spend.currentSpend;
    s.labourTotal = spend.labourTotal;
    s.materialTotal = spend.materialTotal;
    s.unexpectedTotal = spend.unexpectedTotal;
    if (req.user.role !== 'supervisor') {
      s.remainingAmount = calcRemainingAmount(site.totalValuation, site.amountReceived);
      s.remainingBudget = calcRemainingBudget(site.totalValuation, spend.currentSpend);
      s.warning = shouldShowWarning(s.remainingAmount);
      s.profit = site.status === 'closed' ? calcSiteProfit(site.totalValuation, spend.currentSpend) : null;
    }
    res.json({ success: true, site: s });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get site' });
  }
};

// POST /api/sites/:id/report-pdf   body: { start, end, advances }
// start/end are YYYY-MM-DD. `advances` maps a worker+labour-type key to the advance
// entered on the site page (advances aren't stored, so the page sends what it shows).
exports.downloadSiteReport = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const { start, end, advances } = req.body || {};
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormat.test(start || '') || !dateFormat.test(end || '')) {
      return res.status(400).json({ success: false, message: 'Start and end dates are required (YYYY-MM-DD)' });
    }
    // Entries are stored at UTC midnight of the chosen day, so compare in UTC
    const from = new Date(`${start}T00:00:00.000Z`);
    const to = new Date(`${end}T23:59:59.999Z`);
    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }
    if (from > to) {
      return res.status(400).json({ success: false, message: 'Start date must be on or before end date' });
    }

    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const dateRange = { $gte: from, $lte: to };
    const [labourLogs, credits] = await Promise.all([
      LabourLog.find({ siteId: site._id, date: dateRange }).sort({ date: 1 }),
      Credit.find({ siteId: site._id, date: dateRange }).sort({ date: 1 }),
    ]);

    // Group attendance by date, then by labour type: how many were present that day
    // (logs are already sorted by date ascending)
    const byDate = new Map();
    labourLogs.forEach(log => {
      const dateKey = log.date.toISOString().slice(0, 10);
      const counts = byDate.get(dateKey) || new Map();
      counts.set(log.labourTypeNameSnapshot, (counts.get(log.labourTypeNameSnapshot) || 0) + Number(log.days || 0));
      byDate.set(dateKey, counts);
    });
    const attendance = [...byDate.entries()].map(([date, counts]) => ({
      date,
      entries: [...counts.entries()]
        .map(([labourType, days]) => ({ labourType, days }))
        .sort((a, b) => a.labourType.localeCompare(b.labourType)),
    }));

    // Worker-wise summary, same grouping as the Weekly Attendance table on the site page
    const advanceFor = key => {
      const value = Number(advances && typeof advances === 'object' ? advances[key] : 0);
      return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const workerRows = new Map();
    labourLogs.forEach(log => {
      const key = `${log.workerId || log.workerNameSnapshot}-${log.labourTypeId || log.labourTypeNameSnapshot}`;
      const row = workerRows.get(key) || {
        workerName: log.workerNameSnapshot,
        labourType: log.labourTypeNameSnapshot,
        days: 0,
        totalSalary: 0,
        advancePaid: advanceFor(key),
      };
      row.days += Number(log.days || 0);
      row.totalSalary += Number(log.totalAmount || 0);
      workerRows.set(key, row);
    });
    const workers = [...workerRows.values()]
      .map(row => ({ ...row, remaining: Math.max(row.totalSalary - row.advancePaid, 0) }))
      .sort((a, b) => a.workerName.localeCompare(b.workerName));

    const pdf = await generateSiteReportPDF({
      range: { start, end },
      site: {
        siteName: site.siteName,
        location: site.location,
        ownerName: site.ownerName,
        ownerPhone: site.ownerPhone,
        sqft: site.sqft,
        status: site.status,
        startDate: site.startDate,
        endDate: site.endDate,
      },
      workers,
      attendance,
      credits: credits.map(c => ({ date: c.date, shopName: c.shopName, amount: c.amount, status: c.status })),
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="site-report-${start}-to-${end}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (err) {
    console.error('Site report PDF failed:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

// POST /api/sites
exports.createSite = async (req, res) => {
  try {
    const { siteName, location, ownerName, ownerPhone, sqft, totalValuation,
      amountReceived, startDate, status, assignedSupervisors } = req.body;
    if (!siteName || !location || !ownerName || !ownerPhone || totalValuation === undefined) {
      return res.status(400).json({ success: false, message: 'Required fields: siteName, location, ownerName, ownerPhone, totalValuation' });
    }
    if (isNaN(totalValuation) || Number(totalValuation) < 0) {
      return res.status(400).json({ success: false, message: 'Total valuation must be a non-negative number' });
    }

    // Build assigned arrays based on role
    let admins = [];
    let supervisors = [];
    if (req.user.role === 'admin') {
      admins = [req.user._id];
      supervisors = Array.isArray(assignedSupervisors) ? assignedSupervisors : [];
    } else if (req.user.role === 'supervisor') {
      supervisors = [req.user._id];
    } else if (req.user.role === 'superadmin') {
      // Superadmin assigns via "Assign Users" modal after creation
      admins = Array.isArray(req.body.assignedAdmins) ? req.body.assignedAdmins : [];
      supervisors = Array.isArray(assignedSupervisors) ? assignedSupervisors : [];
    }

    const site = await Site.create({
      siteName, location, ownerName, ownerPhone,
      sqft: Number(sqft) || 0,
      totalValuation: Number(totalValuation),
      amountReceived: Number(amountReceived) || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: status || 'active',
      createdBy: req.user._id,
      assignedAdmins: admins,
      assignedSupervisors: supervisors,
    });
    res.status(201).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create site' });
  }
};

// PUT /api/sites/:id
exports.updateSite = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only superadmin can change assignments
    const allowedFields = ['siteName', 'location', 'ownerName', 'ownerPhone', 'sqft',
      'totalValuation', 'amountReceived', 'startDate', 'endDate', 'status'];
    if (req.user.role === 'superadmin') {
      allowedFields.push('assignedAdmins', 'assignedSupervisors');
    }

    const updates = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const updated = await Site.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, site: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update site' });
  }
};

// POST /api/sites/:id/labour
exports.addLabour = async (req, res) => {
  try {
    const { date, labourTypeId, workerId, days, rateOverride, advancePaid, remarks, paid } = req.body;
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!labourTypeId || !workerId || !days) {
      return res.status(400).json({ success: false, message: 'Labour type, worker and days required' });
    }
    if (!isValidObjectId(labourTypeId) || !isValidObjectId(workerId)) {
      return res.status(400).json({ success: false, message: 'Invalid labour type or worker ID' });
    }
    const labourType = await LabourType.findById(labourTypeId);
    const worker = await Worker.findById(workerId);
    if (!labourType) return res.status(404).json({ success: false, message: 'Labour type not found' });
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    const rateAtTime = rateOverride !== undefined && rateOverride !== null && rateOverride !== ''
      ? Number(rateOverride) : labourType.ratePerDay;
    const totalAmount = calcLabourTotal(Number(days), rateAtTime);
    const parsedAdvance = Number(advancePaid || 0);
    const isPaid = Boolean(paid) || parsedAdvance >= totalAmount;

    const log = await LabourLog.create({
      siteId: site._id,
      date: date ? new Date(date) : new Date(),
      labourTypeId,
      workerId,
      workerNameSnapshot: worker.name,
      labourTypeNameSnapshot: labourType.name,
      days: Number(days),
      rateAtTime,
      totalAmount,
      advancePaid: Math.min(parsedAdvance, totalAmount),
      paid: isPaid,
      remarks: remarks || '',
      createdBy: req.user._id,
    });

    // Auto-create attendance record
    try {
      await Attendance.create({
        siteId: site._id,
        workerId,
        workerNameSnapshot: worker.name,
        labourTypeId,
        labourTypeNameSnapshot: labourType.name,
        date: log.date,
        labourLogId: log._id,
      });
    } catch (attendErr) {
      // Ignore duplicate attendance (unique index on labourLogId)
    }

    res.status(201).json({ success: true, labourLog: log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add labour' });
  }
};

// GET /api/sites/:id/labour
exports.getLabourLogs = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const logs = await LabourLog.find({ siteId: req.params.id }).sort({ date: -1 });
    res.json({ success: true, labourLogs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get labour logs' });
  }
};

exports.updateLabourLog = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.logId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const log = await LabourLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Labour log not found' });
    const { advancePaid, paid } = req.body;
    const nextAdvance = Number(advancePaid ?? log.advancePaid ?? 0);
    const finalAdvance = Math.min(Math.max(nextAdvance, 0), Number(log.totalAmount || 0));
    log.advancePaid = finalAdvance;
    log.paid = paid === undefined ? finalAdvance >= Number(log.totalAmount || 0) : Boolean(paid);
    if (paid !== undefined && Boolean(paid)) {
      log.advancePaid = Number(log.totalAmount || 0);
      log.paid = true;
    }
    await log.save();
    res.json({ success: true, labourLog: log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update labour log' });
  }
};

// POST /api/sites/:id/material
exports.addMaterial = async (req, res) => {
  try {
    const { date, materialId, unit, quantity, rateAtTime, discount, remarks } = req.body;
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!materialId || !unit || quantity === undefined || rateAtTime === undefined) {
      return res.status(400).json({ success: false, message: 'Material, unit, quantity and rate required' });
    }
    if (!isValidObjectId(materialId)) {
      return res.status(400).json({ success: false, message: 'Invalid material ID' });
    }
    const material = await Material.findById(materialId);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    const discountNum = Number(discount) || 0;
    const totalAmount = calcMaterialTotal(Number(quantity), Number(rateAtTime), discountNum);

    const log = await MaterialLog.create({
      siteId: site._id,
      date: date ? new Date(date) : new Date(),
      materialId,
      materialNameSnapshot: material.name,
      unit,
      quantity: Number(quantity),
      rateAtTime: Number(rateAtTime),
      discount: discountNum,
      totalAmount,
      remarks: remarks || '',
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, materialLog: log });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add material' });
  }
};

// GET /api/sites/:id/material
exports.getMaterialLogs = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const logs = await MaterialLog.find({ siteId: req.params.id }).sort({ date: -1 });
    res.json({ success: true, materialLogs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get material logs' });
  }
};

// POST /api/sites/:id/unexpected-cost
exports.addUnexpectedCost = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { name, remarks, amount, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Name and amount required' });
    }
    if (isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }
    const cost = await UnexpectedCost.create({
      siteId: site._id,
      name,
      remarks: remarks || '',
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, unexpectedCost: cost });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add unexpected cost' });
  }
};

// GET /api/sites/:id/unexpected-cost
exports.getUnexpectedCosts = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const costs = await UnexpectedCost.find({ siteId: req.params.id }).sort({ date: -1 });
    res.json({ success: true, unexpectedCosts: costs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get unexpected costs' });
  }
};

// POST /api/sites/:id/contracts
exports.addContract = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { contractTypeId, contractTypeName, priceAtTime, date } = req.body;
    if (!priceAtTime) {
      return res.status(400).json({ success: false, message: 'Price required' });
    }

    let nameSnapshot = contractTypeName;
    if (contractTypeId && isValidObjectId(contractTypeId)) {
      const ct = await ContractType.findById(contractTypeId);
      if (ct) nameSnapshot = ct.name;
    }
    if (!nameSnapshot) {
      return res.status(400).json({ success: false, message: 'Contract type name required' });
    }

    const contract = await SiteContract.create({
      siteId: site._id,
      contractTypeId: contractTypeId && isValidObjectId(contractTypeId) ? contractTypeId : undefined,
      contractTypeNameSnapshot: nameSnapshot,
      priceAtTime: Number(priceAtTime),
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, contract });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add contract' });
  }
};

// GET /api/sites/:id/contracts
exports.getContracts = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const contracts = await SiteContract.find({ siteId: req.params.id }).sort({ date: -1 });
    res.json({ success: true, contracts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get contracts' });
  }
};

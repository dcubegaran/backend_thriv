const Credit = require('../models/Credit');
const Site = require('../models/Site');
const { isValidObjectId, sameNameRegex, sameDayRange } = require('../utils/validate');

// Helper: all sites are shared between every admin and supervisor (same rule as siteController)
function canAccessSite(user) {
  return ['superadmin', 'admin', 'supervisor'].includes(user.role);
}

// GET /api/credits?siteId=...
exports.getCredits = async (req, res) => {
  try {
    const { siteId, status } = req.query;
    const query = {};
    if (siteId) {
      if (!isValidObjectId(siteId)) {
        return res.status(400).json({ success: false, message: 'Invalid site ID' });
      }
      query.siteId = siteId;
    }
    if (status) query.status = status;

    const credits = await Credit.find(query)
      .populate('siteId', 'siteName location')
      .sort({ date: -1 });
    res.json({ success: true, credits });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get credits' });
  }
};

// POST /api/credits
exports.createCredit = async (req, res) => {
  try {
    const { siteId, shopName, amount, date, remarks } = req.body;
    if (!siteId || !shopName || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Site, shop name and amount required' });
    }
    if (!isValidObjectId(siteId)) {
      return res.status(400).json({ success: false, message: 'Invalid site ID' });
    }
    if (isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }
    const site = await Site.findById(siteId);
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    if (!canAccessSite(req.user, site)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const entryDate = date ? new Date(date) : new Date();
    const duplicate = await Credit.exists({
      siteId, shopName: sameNameRegex(shopName), amount: Number(amount), date: sameDayRange(entryDate),
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'The same credit already exists for this date' });
    }
    const credit = await Credit.create({
      siteId,
      shopName: String(shopName).trim(),
      amount: Number(amount),
      remarks: String(remarks || '').trim(),
      date: entryDate,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, credit });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create credit' });
  }
};

// PUT /api/credits/:id/close
exports.closeCredit = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const credit = await Credit.findById(req.params.id);
    if (!credit) return res.status(404).json({ success: false, message: 'Credit not found' });
    if (credit.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Credit is already closed' });
    }
    credit.status = 'closed';
    credit.closedAt = new Date();
    await credit.save();
    res.json({ success: true, credit });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to close credit' });
  }
};

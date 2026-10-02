const Site = require('../models/Site');
const LabourLog = require('../models/LabourLog');
const MaterialLog = require('../models/MaterialLog');
const UnexpectedCost = require('../models/UnexpectedCost');
const SiteContract = require('../models/SiteContract');
const ExtraExpense = require('../models/ExtraExpense');
const PersonalExpense = require('../models/PersonalExpense');
const {
  calcCurrentSpend, calcRemainingAmount, calcRemainingBudget,
  calcSiteProfit, calcActualProfit
} = require('../utils/calculations');

// GET /api/reports
exports.getReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to year-to-date
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : now;
    end.setHours(23, 59, 59, 999);

    // Determine accessible sites
    let siteQuery = {};
    if (req.user.role === 'admin') {
      siteQuery = { assignedAdmins: req.user._id };
    } else if (req.user.role === 'supervisor') {
      siteQuery = { assignedSupervisors: req.user._id };
    }

    const sites = await Site.find(siteQuery);
    const siteIds = sites.map(s => s._id);

    const dateRange = { $gte: start, $lte: end };

    const [labourLogs, materialLogs, unexpectedCosts, contracts, extraExpenses, personalExpenses] = await Promise.all([
      LabourLog.find({ siteId: { $in: siteIds }, date: dateRange }),
      MaterialLog.find({ siteId: { $in: siteIds }, date: dateRange }),
      UnexpectedCost.find({ siteId: { $in: siteIds }, date: dateRange }),
      SiteContract.find({ siteId: { $in: siteIds }, date: dateRange }),
      ExtraExpense.find({ siteId: { $in: siteIds }, date: dateRange }),
      req.user.role !== 'supervisor'
        ? PersonalExpense.find({ date: dateRange })
        : Promise.resolve([]),
    ]);

    const labourTotal = labourLogs.reduce((s, l) => s + l.totalAmount, 0);
    const materialTotal = materialLogs.reduce((s, m) => s + m.totalAmount, 0);
    const unexpectedTotal = unexpectedCosts.reduce((s, u) => s + u.amount, 0);
    const contractTotal = contracts.reduce((s, c) => s + c.priceAtTime, 0);
    const extraTotal = extraExpenses.reduce((s, e) => s + e.amount, 0);
    const currentSpend = calcCurrentSpend(labourTotal, materialTotal, unexpectedTotal, contractTotal, extraTotal);
    const personalExpenseTotal = personalExpenses.reduce((s, p) => s + p.amount, 0);

    // Per-site breakdown
    const siteBreakdown = await Promise.all(sites.map(async (site) => {
      const siteLogs = labourLogs.filter(l => l.siteId.toString() === site._id.toString());
      const siteMats = materialLogs.filter(m => m.siteId.toString() === site._id.toString());
      const siteUnex = unexpectedCosts.filter(u => u.siteId.toString() === site._id.toString());

      const siteLabour = siteLogs.reduce((s, l) => s + l.totalAmount, 0);
      const siteMaterial = siteMats.reduce((s, m) => s + m.totalAmount, 0);
      const siteUnexpected = siteUnex.reduce((s, u) => s + u.amount, 0);
      const isThisSite = item => item.siteId.toString() === site._id.toString();
      const siteContract = contracts.filter(isThisSite).reduce((s, c) => s + c.priceAtTime, 0);
      const siteExtra = extraExpenses.filter(isThisSite).reduce((s, e) => s + e.amount, 0);
      const siteSpend = calcCurrentSpend(siteLabour, siteMaterial, siteUnexpected, siteContract, siteExtra);

      const remainingAmount = calcRemainingAmount(site.totalValuation, site.amountReceived);
      const remainingBudget = calcRemainingBudget(site.totalValuation, siteSpend);
      const profit = site.status === 'closed' ? calcSiteProfit(site.totalValuation, siteSpend) : null;

      return {
        siteId: site._id,
        siteName: site.siteName,
        location: site.location,
        status: site.status,
        totalValuation: site.totalValuation,
        amountReceived: site.amountReceived,
        labourTotal: siteLabour,
        materialTotal: siteMaterial,
        unexpectedTotal: siteUnexpected,
        contractTotal: siteContract,
        extraTotal: siteExtra,
        currentSpend: siteSpend,
        remainingAmount,
        remainingBudget,
        profit,
      };
    }));

    // Closed sites profit
    const closedSiteProfit = siteBreakdown
      .filter(s => s.status === 'closed')
      .reduce((sum, s) => sum + (s.profit || 0), 0);

    const actualProfit = req.user.role !== 'supervisor'
      ? calcActualProfit(closedSiteProfit, personalExpenseTotal)
      : null;

    // Monthly breakdown for charts
    const monthlyData = buildMonthlyBreakdown(labourLogs, materialLogs, unexpectedCosts, start, end);

    res.json({
      success: true,
      report: {
        period: { start, end },
        summary: {
          labourTotal,
          materialTotal,
          unexpectedTotal,
          contractTotal,
          extraTotal,
          currentSpend,
          personalExpenseTotal: req.user.role !== 'supervisor' ? personalExpenseTotal : undefined,
          closedSiteProfit,
          actualProfit,
          totalValuation: sites.reduce((s, site) => s + site.totalValuation, 0),
          amountReceived: sites.reduce((s, site) => s + site.amountReceived, 0),
          activeSites: sites.filter(s => s.status === 'active').length,
          closedSites: sites.filter(s => s.status === 'closed').length,
        },
        siteBreakdown,
        monthlyData,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

function buildMonthlyBreakdown(labourLogs, materialLogs, unexpectedCosts, start, end) {
  const months = {};

  const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  labourLogs.forEach(l => {
    const key = getMonthKey(l.date);
    if (!months[key]) months[key] = { month: key, labour: 0, material: 0, unexpected: 0 };
    months[key].labour += l.totalAmount;
  });

  materialLogs.forEach(m => {
    const key = getMonthKey(m.date);
    if (!months[key]) months[key] = { month: key, labour: 0, material: 0, unexpected: 0 };
    months[key].material += m.totalAmount;
  });

  unexpectedCosts.forEach(u => {
    const key = getMonthKey(u.date);
    if (!months[key]) months[key] = { month: key, labour: 0, material: 0, unexpected: 0 };
    months[key].unexpected += u.amount;
  });

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

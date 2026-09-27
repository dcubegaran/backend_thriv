const PersonalExpense = require('../models/PersonalExpense');
const { sameNameRegex, sameDayRange } = require('../utils/validate');

// GET /api/personal-expenses - superadmin and admin only
exports.getPersonalExpenses = async (req, res) => {
  try {
    const { person, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = {};

    if (person) {
      query.name = { $regex: person, $options: 'i' };
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const total = await PersonalExpense.countDocuments(query);
    const expenses = await PersonalExpense.find(query)
      .populate('addedBy', 'name')
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const totalAmount = await PersonalExpense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      success: true,
      expenses,
      total,
      totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get personal expenses' });
  }
};

// POST /api/personal-expenses - all roles
exports.addPersonalExpense = async (req, res) => {
  try {
    const { name, reason, amount, date } = req.body;
    if (!name || !reason || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Name, reason and amount required' });
    }
    if (isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }
    const entryDate = date ? new Date(date) : new Date();
    const duplicate = await PersonalExpense.exists({
      name: sameNameRegex(name), reason: sameNameRegex(reason), amount: Number(amount), date: sameDayRange(entryDate),
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'The same expense already exists for this date' });
    }
    const expense = await PersonalExpense.create({
      name,
      reason,
      amount: Number(amount),
      date: entryDate,
      addedBy: req.user._id,
    });
    res.status(201).json({ success: true, expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add personal expense' });
  }
};

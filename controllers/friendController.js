const Friend = require('../models/Friend');
const { sameNameRegex } = require('../utils/validate');

// GET /api/friends
exports.getFriends = async (req, res) => {
  try {
    const friends = await Friend.find({}).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, friends });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get friends' });
  }
};

// POST /api/friends   body: { name, city, amount, date }
exports.createFriend = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const city = String(req.body.city || '').trim();
    const { amount } = req.body;
    if (!name || !city || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, message: 'Name, city and amount required' });
    }
    if (isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    }
    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    if (await Friend.exists({ name: sameNameRegex(name), city: sameNameRegex(city) })) {
      return res.status(400).json({ success: false, message: 'A friend with this name and city already exists' });
    }
    const friend = await Friend.create({ name, city, amount: Number(amount), date, createdBy: req.user._id });
    res.status(201).json({ success: true, friend });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add friend' });
  }
};

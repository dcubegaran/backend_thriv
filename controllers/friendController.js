const Friend = require('../models/Friend');
const FriendEntry = require('../models/FriendEntry');
const { sameNameRegex, isValidObjectId } = require('../utils/validate');

// Friends saved before Spent / Received entries: their old single amount is dropped (not counted as Spent),
// so Spent and Received only hold entries added inside the friend
async function dropOldAmounts() {
  await Friend.updateMany({ amount: { $exists: true } }, { $unset: { amount: 1, reason: 1, date: 1 } });
}

// { friendId: { spent, received } }
async function totalsByFriend(match = {}) {
  const rows = await FriendEntry.aggregate([
    { $match: match },
    { $group: { _id: { friendId: '$friendId', type: '$type' }, total: { $sum: '$amount' } } },
  ]);
  const totals = {};
  rows.forEach(r => {
    const key = String(r._id.friendId);
    totals[key] = totals[key] || { spent: 0, received: 0 };
    totals[key][r._id.type] = r.total;
  });
  return totals;
}

const withTotals = (friend, totals) => {
  const t = totals[String(friend._id)] || { spent: 0, received: 0 };
  return { ...friend.toObject(), spent: t.spent, received: t.received };
};

// GET /api/friends - friends with their Spent / Received totals
exports.getFriends = async (req, res) => {
  try {
    await dropOldAmounts();
    const [friends, totals] = await Promise.all([Friend.find({}).sort({ name: 1 }), totalsByFriend()]);
    res.json({ success: true, friends: friends.map(f => withTotals(f, totals)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get friends' });
  }
};

// GET /api/friends/:id - one friend, with totals and every entry (newest first)
exports.getFriend = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    await dropOldAmounts();
    const friend = await Friend.findById(req.params.id);
    if (!friend) return res.status(404).json({ success: false, message: 'Friend not found' });
    const [entries, totals] = await Promise.all([
      FriendEntry.find({ friendId: friend._id }).sort({ date: -1, createdAt: -1 }),
      totalsByFriend({ friendId: friend._id }),
    ]);
    res.json({ success: true, friend: withTotals(friend, totals), entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get friend' });
  }
};

// POST /api/friends   body: { name, city }
exports.createFriend = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const city = String(req.body.city || '').trim();
    if (!name || !city) {
      return res.status(400).json({ success: false, message: 'Name and city required' });
    }
    if (await Friend.exists({ name: sameNameRegex(name), city: sameNameRegex(city) })) {
      return res.status(400).json({ success: false, message: 'A friend with this name and city already exists' });
    }
    const friend = await Friend.create({ name, city, createdBy: req.user._id });
    res.status(201).json({ success: true, friend: withTotals(friend, {}) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add friend' });
  }
};

// DELETE /api/friends/:id - also deletes the friend's entries
exports.deleteFriend = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const friend = await Friend.findByIdAndDelete(req.params.id);
    if (!friend) return res.status(404).json({ success: false, message: 'Friend not found' });
    await FriendEntry.deleteMany({ friendId: friend._id });
    res.json({ success: true, message: 'Friend deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete friend' });
  }
};

// POST /api/friends/:id/entries   body: { type: 'spent' | 'received', amount, date, reason }
exports.addEntry = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const { type, amount } = req.body;
    if (!['spent', 'received'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid entry type' });
    if (amount === undefined || amount === null || amount === '' || isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }
    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: 'Invalid date' });
    if (!(await Friend.exists({ _id: req.params.id }))) return res.status(404).json({ success: false, message: 'Friend not found' });
    const entry = await FriendEntry.create({
      friendId: req.params.id, type, amount: Number(amount), date,
      reason: String(req.body.reason || '').trim().slice(0, 1000), createdBy: req.user._id,
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add entry' });
  }
};

// DELETE /api/friends/:id/entries/:entryId
exports.deleteEntry = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.entryId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const entry = await FriendEntry.findOneAndDelete({ _id: req.params.entryId, friendId: req.params.id });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete entry' });
  }
};

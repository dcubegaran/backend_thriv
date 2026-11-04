const mongoose = require('mongoose');
const Friend = require('../models/Friend');
const FriendEntry = require('../models/FriendEntry');

// When Friends moved to Spent / Received, each friend's old single amount was turned into a Spent entry.
// Those entries were all created together, the first time the friends list loaded after that update.
// The entry for each friend that existed then is its first Spent entry from that batch; entries added by
// hand later are never matched.
const BATCH_WINDOW_MS = 30 * 1000;
const MIGRATION_NAME = 'remove-old-friend-amounts';

async function findOldFriendAmounts() {
  const first = await FriendEntry.findOne({}).sort({ createdAt: 1 }).lean();
  if (!first) return [];
  const batchStart = first.createdAt;
  const batchEnd = new Date(batchStart.getTime() + BATCH_WINDOW_MS);
  const oldFriends = await Friend.find({ createdAt: { $lte: batchEnd } }).lean();
  const found = [];
  for (const friend of oldFriends) {
    const entry = await FriendEntry.findOne({
      friendId: friend._id, type: 'spent', createdAt: { $gte: batchStart, $lte: batchEnd },
    }).sort({ createdAt: 1 }).lean();
    if (entry) found.push({ friend, entry });
  }
  return found;
}

async function deleteOldFriendAmounts(found) {
  if (!found.length) return 0;
  const result = await FriendEntry.deleteMany({ _id: { $in: found.map(x => x.entry._id) } });
  return result.deletedCount;
}

// Runs once per database (remembered in the "migrations" collection), at server start
async function removeOldFriendAmountsOnce() {
  const migrations = mongoose.connection.collection('migrations');
  if (await migrations.findOne({ name: MIGRATION_NAME })) return;
  const removed = await deleteOldFriendAmounts(await findOldFriendAmounts());
  await migrations.insertOne({ name: MIGRATION_NAME, removed, ranAt: new Date() });
  console.log(`Removed ${removed} old friend amount(s) from Spent`);
}

module.exports = { findOldFriendAmounts, deleteOldFriendAmounts, removeOldFriendAmountsOnce, MIGRATION_NAME };

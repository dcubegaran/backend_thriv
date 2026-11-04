// One-time cleanup: removes the Spent entries that were made from friends' old single amount
// (when Friends moved to Spent / Received, each friend's amount was turned into a Spent entry).
//
// Those entries were all created together, the first time the friends list loaded after the update.
// For every friend that existed before then, the entry removed is its first Spent entry from that batch.
// Entries added by hand later are never touched.
//
//   node tools/removeOldFriendAmounts.js           -> only lists what would be removed
//   node tools/removeOldFriendAmounts.js --apply   -> removes them
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Friend = require('../models/Friend');
const FriendEntry = require('../models/FriendEntry');

const BATCH_WINDOW_MS = 2 * 60 * 1000; // the converted entries were created within seconds of each other

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const first = await FriendEntry.findOne({}).sort({ createdAt: 1 }).lean();
    if (!first) {
      console.log('No friend entries - nothing to remove.');
      return;
    }
    const batchStart = first.createdAt;
    const batchEnd = new Date(batchStart.getTime() + BATCH_WINDOW_MS);
    const oldFriends = await Friend.find({ createdAt: { $lte: batchEnd } }).lean();

    const toRemove = [];
    for (const friend of oldFriends) {
      const entry = await FriendEntry.findOne({
        friendId: friend._id, type: 'spent', createdAt: { $gte: batchStart, $lte: batchEnd },
      }).sort({ createdAt: 1 }).lean();
      if (entry) toRemove.push({ friend, entry });
    }

    if (!toRemove.length) {
      console.log('No converted old amounts found - nothing to remove.');
      return;
    }
    console.log(`${apply ? 'Removing' : 'Would remove'} ${toRemove.length} old amount(s):`);
    toRemove.forEach(({ friend, entry }) => {
      console.log(`  ${friend.name} (${friend.city}): ${entry.amount} on ${entry.date?.toISOString().slice(0, 10)}${entry.reason ? ` - ${entry.reason}` : ''}`);
    });
    if (!apply) {
      console.log('\nNothing removed. Run again with --apply to remove these.');
      return;
    }
    const result = await FriendEntry.deleteMany({ _id: { $in: toRemove.map(x => x.entry._id) } });
    console.log(`Removed ${result.deletedCount}.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

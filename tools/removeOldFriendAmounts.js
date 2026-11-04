// Lists (or removes) the Spent entries made from friends' old single amount.
// The server also does this by itself, once, when it starts (see utils/oldFriendAmounts.js).
//
//   node tools/removeOldFriendAmounts.js           -> only lists what would be removed
//   node tools/removeOldFriendAmounts.js --apply   -> removes them
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { findOldFriendAmounts, deleteOldFriendAmounts } = require('../utils/oldFriendAmounts');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const found = await findOldFriendAmounts();
    if (!found.length) {
      console.log('No converted old amounts found - nothing to remove.');
      return;
    }
    console.log(`${apply ? 'Removing' : 'Would remove'} ${found.length} old amount(s):`);
    found.forEach(({ friend, entry }) => {
      console.log(`  ${friend.name} (${friend.city}): ${entry.amount} on ${entry.date?.toISOString().slice(0, 10)}${entry.reason ? ` - ${entry.reason}` : ''}`);
    });
    if (!apply) {
      console.log('\nNothing removed. Run again with --apply to remove these.');
      return;
    }
    console.log(`Removed ${await deleteOldFriendAmounts(found)}.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

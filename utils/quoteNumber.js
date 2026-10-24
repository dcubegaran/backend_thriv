/**
 * Generate a quote number in format BHB-YEAR-NNNNN
 * Finds the last quote number for the year and increments
 */
async function generateQuoteNumber(Model) {
  const year = new Date().getFullYear();
  const prefix = `BHB-${year}-`;

  // Find latest quote for this year
  const latest = await Model.findOne(
    { quoteNumber: { $regex: `^${prefix}` } },
    { quoteNumber: 1 },
    { sort: { quoteNumber: -1 } }
  );

  let seq = 1;
  if (latest && latest.quoteNumber) {
    const parts = latest.quoteNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

module.exports = { generateQuoteNumber };

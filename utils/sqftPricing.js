// Picks which sqft price range applies to a given area.
// NOTE: the public quote form (client/src/pages/public/HomePage.jsx) repeats this rule so the
// live preview matches what the server calculates. Keep the two in sync.

const rangeMin = range => Number(range.minSqft ?? 0);
const rangeMax = range => (
  range.maxSqft === undefined || range.maxSqft === null || range.maxSqft === ''
    ? Number.MAX_SAFE_INTEGER // no max = open-ended range
    : Number(range.maxSqft)
);

/**
 * pricingList: active ranges [{ minSqft, maxSqft?, ratePerSqft, ... }]
 *
 * 1. A range that contains the area (minSqft <= area <= maxSqft).
 * 2. Otherwise (area above the last range, or in a gap between ranges): the highest range that
 *    starts at or below the area. e.g. 5000 sqft with ranges up to 4000 uses the top range's rate.
 * 3. Otherwise (area below every range): the lowest range.
 *
 * Returns the chosen range, or null when there are no ranges / the area isn't a number.
 */
function pickSqftRange(pricingList, sqftValue) {
  const value = Number(sqftValue);
  if (!Array.isArray(pricingList) || pricingList.length === 0 || !Number.isFinite(value)) return null;

  const ranges = [...pricingList].sort((a, b) => rangeMin(a) - rangeMin(b) || rangeMax(a) - rangeMax(b));

  const containing = ranges.find(range => value >= rangeMin(range) && value <= rangeMax(range));
  if (containing) return containing;

  const startedBelow = ranges.filter(range => rangeMin(range) <= value);
  return startedBelow.length ? startedBelow[startedBelow.length - 1] : ranges[0];
}

module.exports = { pickSqftRange };

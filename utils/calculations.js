// Centralized financial calculation functions
// All amounts are in numeric values (no currency symbols)

/**
 * Calculate total labour cost for a log entry
 */
function calcLabourTotal(days, rateAtTime) {
  return Math.max(0, days * rateAtTime);
}

/**
 * Calculate total material cost for a log entry
 */
function calcMaterialTotal(quantity, rateAtTime, discount = 0) {
  const gross = quantity * rateAtTime;
  return Math.max(0, gross - discount);
}

/**
 * Calculate Current Spend for a site
 * Current Spend = Labour + Material + Unexpected Costs
 */
function calcCurrentSpend(labourTotal, materialTotal, unexpectedTotal) {
  return labourTotal + materialTotal + unexpectedTotal;
}

/**
 * Remaining Amount = Total Valuation - Amount Received
 * (Money still owed by the client)
 */
function calcRemainingAmount(totalValuation, amountReceived) {
  return totalValuation - amountReceived;
}

/**
 * Remaining Budget = Total Valuation - Current Spend
 * (How much project budget remains after spending)
 */
function calcRemainingBudget(totalValuation, currentSpend) {
  return totalValuation - currentSpend;
}

/**
 * Closed Site Profit = Total Valuation - Current Spend
 * Only shown for closed sites
 */
function calcSiteProfit(totalValuation, currentSpend) {
  return totalValuation - currentSpend;
}

/**
 * Actual Business Profit = Project Profit - Personal Expenses
 */
function calcActualProfit(projectProfit, personalExpensesTotal) {
  return projectProfit - personalExpensesTotal;
}

/**
 * Apply offers to a base amount
 * Returns { finalAmount, discountsApplied }
 */
function applyOffers(baseAmount, offers) {
  let amount = baseAmount;
  const appliedOffers = [];

  for (const offer of offers) {
    let discountApplied = 0;
    if (offer.discountType === 'fixed') {
      discountApplied = offer.discountValue;
    } else if (offer.discountType === 'percentage') {
      discountApplied = (amount * offer.discountValue) / 100;
    }
    // Prevent going negative
    const newAmount = Math.max(0, amount - discountApplied);
    discountApplied = amount - newAmount;
    amount = newAmount;

    appliedOffers.push({
      offerId: offer._id || offer.offerId,
      titleEn: offer.titleEn,
      titleTa: offer.titleTa || '',
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      discountApplied,
    });
  }

  return { finalAmount: amount, appliedOffers };
}

/**
 * Whether a site should show the ₹75,000 warning
 * Warning when: remainingAmount < 75000 (strictly less than)
 */
function shouldShowWarning(remainingAmount) {
  return remainingAmount < 75000;
}

module.exports = {
  calcLabourTotal,
  calcMaterialTotal,
  calcCurrentSpend,
  calcRemainingAmount,
  calcRemainingBudget,
  calcSiteProfit,
  calcActualProfit,
  applyOffers,
  shouldShowWarning,
};

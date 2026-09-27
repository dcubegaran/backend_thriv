const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone number (basic - allows digits, spaces, +, -)
 */
function isValidPhone(phone) {
  return /^[\d\s+\-()]{7,15}$/.test(phone);
}

/**
 * Case-insensitive exact-match regex for a name (used for duplicate checks)
 */
function sameNameRegex(name) {
  const escaped = String(name || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Mongo range covering the whole UTC day of a date (entries are stored at UTC midnight)
 */
function sameDayRange(date) {
  const d = new Date(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { $gte: start, $lte: end };
}

module.exports = { isValidObjectId, isValidEmail, isValidPhone, sameNameRegex, sameDayRange };

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

module.exports = { isValidObjectId, isValidEmail, isValidPhone };

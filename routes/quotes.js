const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, requireRole } = require('../middleware/auth');
const {
  submitPublicQuote, generatePublicPDF,
  getQuotes, getQuote, updateQuoteStatus, generateFinalQuote,
  getGeneratedQuotes, downloadGeneratedPDF, deleteQuote, deleteGeneratedQuote
} = require('../controllers/quoteController');

// Rate limiter for public quote submission
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/public', quoteLimiter, submitPublicQuote);
router.post('/public/pdf', quoteLimiter, generatePublicPDF);

// Protected routes - superadmin, admin, supervisor
router.post('/manual', protect, requireRole('superadmin', 'admin', 'supervisor'), async (req, res) => {
  const { name, city, sqft, phone, remarks } = req.body;
  if (!name || !city || !sqft || !phone) {
    return res.status(400).json({ success: false, message: 'Name, city, sqft and phone are required' });
  }

  try {
    const QuoteRequest = require('../models/QuoteRequest');
    const SqftPricing = require('../models/SqftPricing');
    const { pickSqftRange } = require('../utils/sqftPricing');
    const { generateQuoteNumber } = require('../utils/quoteNumber');

    const numericSqft = Number(sqft);
    if (Number.isNaN(numericSqft) || numericSqft < 1) {
      return res.status(400).json({ success: false, message: 'Sqft must be a positive number' });
    }

    const { sameNameRegex } = require('../utils/validate');
    const duplicate = await QuoteRequest.exists({
      name: sameNameRegex(name), phone: String(phone).trim(), sqft: numericSqft,
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'A quote for this customer, phone and sqft already exists' });
    }

    const pricingList = await SqftPricing.find({ active: true });
    const matched = pickSqftRange(pricingList, numericSqft);

    if (!matched) {
      return res.status(400).json({ success: false, message: 'No active sqft pricing configured' });
    }

    const quoteNumber = await generateQuoteNumber(QuoteRequest);
    const quote = await QuoteRequest.create({
      quoteNumber,
      name,
      city,
      sqft: numericSqft,
      phone,
      remarks: remarks || '',
      estimatedAmount: numericSqft * Number(matched.ratePerSqft || 0),
      source: 'manual',
      status: 'New',
    });

    res.status(201).json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create manual quote' });
  }
});

router.get('/', protect, requireRole('superadmin', 'admin', 'supervisor'), getQuotes);
router.get('/:id', protect, requireRole('superadmin', 'admin', 'supervisor'), getQuote);
router.put('/:id/status', protect, requireRole('superadmin', 'admin', 'supervisor'), updateQuoteStatus);
router.post('/:id/generate', protect, requireRole('superadmin', 'admin', 'supervisor'), generateFinalQuote);
router.get('/:id/generated', protect, requireRole('superadmin', 'admin', 'supervisor'), getGeneratedQuotes);
router.get('/:id/generated/:genId/pdf', protect, requireRole('superadmin', 'admin', 'supervisor'), downloadGeneratedPDF);
router.delete('/:id', protect, requireRole('superadmin', 'admin'), deleteQuote);
router.delete('/:id/generated/:genId', protect, requireRole('superadmin', 'admin'), deleteGeneratedQuote);

module.exports = router;

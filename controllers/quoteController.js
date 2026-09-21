const QuoteRequest = require('../models/QuoteRequest');
const GeneratedQuote = require('../models/GeneratedQuote');
const SqftPricing = require('../models/SqftPricing');
const Offer = require('../models/Offer');
const Terms = require('../models/Terms');
const WebsiteContent = require('../models/WebsiteContent');
const { generateQuoteNumber } = require('../utils/quoteNumber');
const { applyOffers } = require('../utils/calculations');
const { isValidObjectId, isValidPhone } = require('../utils/validate');
const { generateQuotePDF } = require('../utils/pdfGenerator');
const { pickSqftRange } = require('../utils/sqftPricing');

// Rate for an area: the range it falls in (see utils/sqftPricing.js for what happens outside all ranges)
const resolveSqftRateForValue = async (sqftValue) => {
  const pricing = await SqftPricing.find({ active: true });
  const chosen = pickSqftRange(pricing, sqftValue);
  if (!chosen) return { rate: 0, range: null };
  return { rate: Number(chosen.ratePerSqft || 0), range: chosen };
};

// POST /api/quotes/public - public quote request
exports.submitPublicQuote = async (req, res) => {
  try {
    // Honeypot check
    if (req.body.website) {
      return res.status(400).json({ success: false, message: 'Invalid submission' });
    }

    const { name, city, sqft, phone, remarks, selectedOfferIds } = req.body;
    if (!name || !city || !sqft || !phone) {
      return res.status(400).json({ success: false, message: 'Name, city, sqft and phone required' });
    }
    if (isNaN(sqft) || Number(sqft) < 1) {
      return res.status(400).json({ success: false, message: 'Sqft must be a positive number' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const { rate: sqftRate } = await resolveSqftRateForValue(sqft);
    if (!sqftRate) {
      return res.status(400).json({ success: false, message: 'No active sqft pricing configured' });
    }

    const baseAmount = Number(sqft) * sqftRate;

    // Apply selected offers
    let selectedOffers = [];
    if (selectedOfferIds && selectedOfferIds.length > 0) {
      selectedOffers = await Offer.find({
        _id: { $in: selectedOfferIds },
        active: true,
      });
    }
    const { finalAmount, appliedOffers } = applyOffers(baseAmount, selectedOffers);

    const quoteNumber = await generateQuoteNumber(QuoteRequest);
    const quoteRequest = await QuoteRequest.create({
      quoteNumber,
      name,
      city,
      sqft: Number(sqft),
      phone,
      remarks: remarks || '',
      estimatedAmount: finalAmount,
      source: 'website',
    });

    res.status(201).json({
      success: true,
      quoteRequest,
      sqftRate,
      baseAmount,
      offersApplied: appliedOffers,
      finalAmount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit quote' });
  }
};

// POST /api/quotes/public/pdf - generate public quote PDF
exports.generatePublicPDF = async (req, res) => {
  try {
    const { quoteRequestId, language = 'en' } = req.body;
    if (!isValidObjectId(quoteRequestId)) {
      return res.status(400).json({ success: false, message: 'Invalid quote request ID' });
    }

    const quoteRequest = await QuoteRequest.findById(quoteRequestId);
    if (!quoteRequest) {
      return res.status(404).json({ success: false, message: 'Quote request not found' });
    }

    const { rate: sqftRate } = await resolveSqftRateForValue(quoteRequest.sqft);
    if (!sqftRate) {
      return res.status(400).json({ success: false, message: 'No active pricing' });
    }

    const baseAmount = quoteRequest.sqft * sqftRate;
    const companyContent = await WebsiteContent.findOne({ section: 'companyInformation' });

    const quoteData = {
      quoteNumber: quoteRequest.quoteNumber,
      date: quoteRequest.createdAt,
      customer: {
        name: quoteRequest.name,
        city: quoteRequest.city,
        phone: quoteRequest.phone,
        sqft: quoteRequest.sqft,
      },
      baseAmount,
      offersApplied: [],
      finalAmount: quoteRequest.estimatedAmount,
      terms: null, // Public quotes don't include terms
      language,
      company: companyContent ? companyContent.data : {},
    };

    const pdfBuffer = await generateQuotePDF(quoteData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quote-${quoteRequest.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

// GET /api/quotes - superadmin/admin
exports.getQuotes = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { quoteNumber: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await QuoteRequest.countDocuments(query);
    const quotes = await QuoteRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    res.json({ success: true, quotes, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get quotes' });
  }
};

// GET /api/quotes/:id
exports.getQuote = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const quote = await QuoteRequest.findById(req.params.id);
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

    const generatedQuotes = await GeneratedQuote.find({ quoteRequestId: req.params.id })
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, quote, generatedQuotes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get quote' });
  }
};

// PUT /api/quotes/:id/status
exports.updateQuoteStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const { status } = req.body;
    const validStatuses = ['New', 'Contacted', 'Site Visit', 'Quotation Sent', 'Converted', 'Rejected', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const quote = await QuoteRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

// POST /api/quotes/:id/generate - generate final internal quote
exports.generateFinalQuote = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const quoteRequest = await QuoteRequest.findById(req.params.id);
    if (!quoteRequest) return res.status(404).json({ success: false, message: 'Quote request not found' });

    const { selectedOfferIds, language = 'en', includeTerms = true } = req.body;

    const { rate: sqftRateAtGeneration } = await resolveSqftRateForValue(quoteRequest.sqft);
    if (!sqftRateAtGeneration) {
      return res.status(400).json({ success: false, message: 'No active sqft pricing' });
    }

    const baseAmount = quoteRequest.sqft * sqftRateAtGeneration;

    // Snapshot selected offers
    let selectedOffers = [];
    if (selectedOfferIds && selectedOfferIds.length > 0) {
      selectedOffers = await Offer.find({ _id: { $in: selectedOfferIds }, active: true });
    }
    const { finalAmount, appliedOffers } = applyOffers(baseAmount, selectedOffers);

    // Snapshot current terms (if requested)
    let termsAtGeneration = '';
    if (includeTerms) {
      const terms = await Terms.findOne({});
      termsAtGeneration = terms ? (language === 'ta' ? terms.textTa : terms.textEn) : '';
    }

    // Get company info for PDF
    const companyContent = await WebsiteContent.findOne({ section: 'companyInformation' });

    const quoteNumber = await generateQuoteNumber(GeneratedQuote);

    const generated = await GeneratedQuote.create({
      quoteNumber,
      quoteRequestId: quoteRequest._id,
      customerName: quoteRequest.name,
      customerCity: quoteRequest.city,
      customerPhone: quoteRequest.phone,
      sqft: quoteRequest.sqft,
      sqftRateAtGeneration,
      baseAmount,
      offersApplied: appliedOffers,
      finalAmount,
      termsAtGeneration,
      language,
      generatedBy: req.user._id,
      quoteType: 'internal',
    });

    // Generate PDF
    const quoteData = {
      quoteNumber: generated.quoteNumber,
      date: generated.createdAt,
      customer: {
        name: generated.customerName,
        city: generated.customerCity,
        phone: generated.customerPhone,
        sqft: generated.sqft,
      },
      sqftRate: sqftRateAtGeneration,
      baseAmount,
      offersApplied: appliedOffers,
      finalAmount,
      terms: termsAtGeneration,
      language,
      company: companyContent ? companyContent.data : {},
    };

    const pdfBuffer = await generateQuotePDF(quoteData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quote-${generated.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate quote' });
  }
};

// GET /api/quotes/:id/generated - list generated quotes for a request
exports.getGeneratedQuotes = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const quotes = await GeneratedQuote.find({ quoteRequestId: req.params.id })
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, generatedQuotes: quotes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get generated quotes' });
  }
};

// GET /api/quotes/:id/generated/:genId/pdf - re-download a generated quote PDF
exports.downloadGeneratedPDF = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.genId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const generated = await GeneratedQuote.findById(req.params.genId);
    if (!generated) return res.status(404).json({ success: false, message: 'Generated quote not found' });

    const companyContent = await WebsiteContent.findOne({ section: 'companyInformation' });

    const quoteData = {
      quoteNumber: generated.quoteNumber,
      date: generated.createdAt,
      customer: {
        name: generated.customerName,
        city: generated.customerCity,
        phone: generated.customerPhone,
        sqft: generated.sqft,
      },
      sqftRate: generated.sqftRateAtGeneration,
      baseAmount: generated.baseAmount,
      offersApplied: generated.offersApplied,
      finalAmount: generated.finalAmount,
      terms: generated.termsAtGeneration,
      language: generated.language,
      company: companyContent ? companyContent.data : {},
    };

    const pdfBuffer = await generateQuotePDF(quoteData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quote-${generated.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

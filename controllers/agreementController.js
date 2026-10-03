const Agreement = require('../models/Agreement');
const { isValidObjectId } = require('../utils/validate');

const MAX_ITEMS = 300;
const MAX_TEXT = 5000;
const MAX_SECTION_TEXT = 200000; // a pasted section can hold several pages

const cleanText = value => String(value ?? '').slice(0, MAX_TEXT);
const cleanList = value => (Array.isArray(value) ? value.slice(0, MAX_ITEMS).map(cleanText) : []);

// Builds the stored fields from the request body; returns { data } or { error }
function readAgreement(body = {}) {
  const language = body.language === 'en' ? 'en' : 'ta';
  const payments = [];
  for (const row of Array.isArray(body.payments) ? body.payments.slice(0, MAX_ITEMS) : []) {
    const raw = row?.amount;
    const empty = raw === undefined || raw === null || raw === '';
    const amount = empty ? null : Number(raw);
    if (!empty && (!Number.isFinite(amount) || amount < 0)) {
      return { error: 'Payment amounts must be non-negative numbers' };
    }
    payments.push({ description: cleanText(row?.description), amount });
  }
  const sections = (Array.isArray(body.sections) ? body.sections.slice(0, 10) : []).map(s => ({
    heading: cleanText(s?.heading),
    text: String(s?.text ?? '').slice(0, MAX_SECTION_TEXT),
    newPage: Boolean(s?.newPage),
  }));
  const data = {
    language,
    title: cleanText(body.title).trim(),
    sections,
    intro: cleanList(body.intro),
    workHeading: cleanText(body.workHeading),
    clauses: cleanList(body.clauses),
    closing: cleanText(body.closing),
    witnesses: cleanList(body.witnesses).slice(0, 10),
    paymentHeading: cleanText(body.paymentHeading),
    payments,
  };
  const hasContent = data.title || data.closing || data.workHeading || data.paymentHeading
    || [...data.intro, ...data.clauses, ...data.witnesses, ...sections.map(s => s.text)].some(s => s.trim())
    || payments.some(p => p.description.trim() || p.amount !== null);
  if (!hasContent) return { error: 'The agreement is empty' };
  return { data };
}

// GET /api/agreements
exports.getAgreements = async (req, res) => {
  try {
    const agreements = await Agreement.find()
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ updatedAt: -1 });
    res.json({ success: true, agreements });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get agreements' });
  }
};

// GET /api/agreements/:id
exports.getAgreement = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found' });
    res.json({ success: true, agreement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get agreement' });
  }
};

// POST /api/agreements
exports.createAgreement = async (req, res) => {
  try {
    const { data, error } = readAgreement(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const agreement = await Agreement.create({ ...data, createdBy: req.user._id, updatedBy: req.user._id });
    res.status(201).json({ success: true, agreement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save agreement' });
  }
};

// PUT /api/agreements/:id
exports.updateAgreement = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const { data, error } = readAgreement(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const agreement = await Agreement.findByIdAndUpdate(
      req.params.id,
      { ...data, updatedBy: req.user._id },
      { new: true, runValidators: true },
    );
    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found' });
    res.json({ success: true, agreement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save agreement' });
  }
};

// DELETE /api/agreements/:id
exports.deleteAgreement = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const agreement = await Agreement.findByIdAndDelete(req.params.id);
    if (!agreement) return res.status(404).json({ success: false, message: 'Agreement not found' });
    res.json({ success: true, message: 'Agreement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete agreement' });
  }
};

const Terms = require('../models/Terms');

// GET /api/terms
exports.getTerms = async (req, res) => {
  try {
    let terms = await Terms.findOne({});
    if (!terms) terms = { textEn: '', textTa: '' };
    res.json({ success: true, terms });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get terms' });
  }
};

// PUT /api/terms - superadmin only
exports.updateTerms = async (req, res) => {
  try {
    const { textEn, textTa } = req.body;
    let terms = await Terms.findOne({});
    if (terms) {
      terms.textEn = textEn !== undefined ? textEn : terms.textEn;
      terms.textTa = textTa !== undefined ? textTa : terms.textTa;
      await terms.save();
    } else {
      terms = await Terms.create({ textEn: textEn || '', textTa: textTa || '' });
    }
    res.json({ success: true, terms });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update terms' });
  }
};

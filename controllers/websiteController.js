const WebsiteContent = require('../models/WebsiteContent');

const DEFAULT_SECTIONS = [
  'hero', 'about', 'founder', 'coFounder', 'trackRecord', 'contact', 'companyInformation'
];

// GET /api/website - public
exports.getWebsite = async (req, res) => {
  try {
    const sections = await WebsiteContent.find({});
    const result = {};
    sections.forEach(s => { result[s.section] = s.data; });
    res.json({ success: true, content: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get website content' });
  }
};

// GET /api/website/:section
exports.getSection = async (req, res) => {
  try {
    const section = await WebsiteContent.findOne({ section: req.params.section });
    res.json({ success: true, data: section ? section.data : {} });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get section' });
  }
};

// PUT /api/website/:section - superadmin only
exports.updateSection = async (req, res) => {
  try {
    const { section } = req.params;
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'Data required' });
    }
    const updated = await WebsiteContent.findOneAndUpdate(
      { section },
      { $set: { data } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated.data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update section' });
  }
};

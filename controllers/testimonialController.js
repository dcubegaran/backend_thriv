const Testimonial = require('../models/Testimonial');
const { isValidObjectId, sameNameRegex } = require('../utils/validate');

exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({}).sort({ createdAt: -1 });
    res.json({ success: true, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get testimonials' });
  }
};

exports.createTestimonial = async (req, res) => {
  try {
    const { customerName, location, textEn, textTa, photo } = req.body;
    if (!customerName || !textEn) {
      return res.status(400).json({ success: false, message: 'Name and text required' });
    }
    if (await Testimonial.exists({ customerName: sameNameRegex(customerName), textEn: sameNameRegex(textEn) })) {
      return res.status(400).json({ success: false, message: 'This testimonial already exists' });
    }
    const t = await Testimonial.create({ customerName, location: location || '', textEn, textTa, photo });
    res.status(201).json({ success: true, testimonial: t });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
};

exports.updateTestimonial = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const t = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, testimonial: t });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update testimonial' });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    await Testimonial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
  }
};

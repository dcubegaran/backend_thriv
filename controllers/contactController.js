const ContactCategory = require('../models/ContactCategory');
const Contact = require('../models/Contact');
const { sameNameRegex, isValidObjectId } = require('../utils/validate');

const PHONE_PATTERN = /^[0-9+\-\s()]{5,20}$/;

// GET /api/contacts - every category and contact (the app filters and groups them)
exports.getContacts = async (req, res) => {
  try {
    const [categories, contacts] = await Promise.all([
      ContactCategory.find({}).sort({ name: 1 }),
      Contact.find({}).sort({ name: 1 }),
    ]);
    res.json({ success: true, categories, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get contacts' });
  }
};

// POST /api/contacts/categories   body: { name }
exports.createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) return res.status(400).json({ success: false, message: 'Category name required' });
    if (await ContactCategory.exists({ name: sameNameRegex(name) })) {
      return res.status(400).json({ success: false, message: 'This category already exists' });
    }
    const category = await ContactCategory.create({ name, createdBy: req.user._id });
    res.status(201).json({ success: true, category });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add category' });
  }
};

// DELETE /api/contacts/categories/:id - also deletes the contacts in it
exports.deleteCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const category = await ContactCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    await Contact.deleteMany({ categoryId: category._id });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
};

// POST /api/contacts   body: { categoryId, name, phone, remarks }
exports.createContact = async (req, res) => {
  try {
    const { categoryId } = req.body;
    const name = String(req.body.name || '').trim().slice(0, 100);
    const phone = String(req.body.phone || '').trim();
    const remarks = String(req.body.remarks || '').trim().slice(0, 1000);
    if (!isValidObjectId(categoryId)) return res.status(400).json({ success: false, message: 'Invalid category' });
    if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and mobile number required' });
    if (!PHONE_PATTERN.test(phone)) return res.status(400).json({ success: false, message: 'Enter a valid mobile number' });
    if (!(await ContactCategory.exists({ _id: categoryId }))) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (await Contact.exists({ categoryId, phone })) {
      return res.status(400).json({ success: false, message: 'A contact with this mobile number already exists in this category' });
    }
    const contact = await Contact.create({ categoryId, name, phone, remarks, createdBy: req.user._id });
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add contact' });
  }
};

// DELETE /api/contacts/:id
exports.deleteContact = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete contact' });
  }
};

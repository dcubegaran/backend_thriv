const Offer = require('../models/Offer');
const { isValidObjectId } = require('../utils/validate');

exports.getOffers = async (req, res) => {
  try {
    // Public route gets only active offers; admin gets all
    const query = req.user ? {} : { active: true };
    const offers = await Offer.find(query).sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get offers' });
  }
};

exports.createOffer = async (req, res) => {
  try {
    const { titleEn, titleTa, descriptionEn, descriptionTa, photo, photos, discountType, discountValue, active } = req.body;
    if (!titleEn) {
      return res.status(400).json({ success: false, message: 'Title (English) required' });
    }
    const offer = await Offer.create({
      titleEn,
      titleTa,
      descriptionEn,
      descriptionTa,
      photo: photo || (Array.isArray(photos) ? photos[0] || '' : ''),
      photos: Array.isArray(photos) ? photos.filter(Boolean) : (photo ? [photo] : []),
      discountType,
      discountValue,
      active,
    });
    res.status(201).json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create offer' });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const { photo, photos, ...rest } = req.body;
    const normalizedPhotos = Array.isArray(photos) ? photos.filter(Boolean) : (photo ? [photo] : []);
    const offer = await Offer.findByIdAndUpdate(req.params.id, {
      ...rest,
      photo: photo || normalizedPhotos[0] || '',
      photos: normalizedPhotos,
    }, { new: true });
    if (!offer) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update offer' });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete offer' });
  }
};

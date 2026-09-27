const Offer = require('../models/Offer');
const { isValidObjectId, sameNameRegex } = require('../utils/validate');

// Percentage offers must be 0-100; fixed offers can't be negative. Returns an error message or null.
function discountError(discountType, discountValue) {
  if (!discountType || discountType === 'none') return null;
  const value = Number(discountValue);
  if (!Number.isFinite(value) || value < 0) return 'Discount value must be a positive number';
  if (discountType === 'percentage' && value > 100) return 'A percentage discount cannot be more than 100%';
  return null;
}

const PUBLIC_OFFER_QUERY = { active: true, showOnWebsite: { $ne: false } };
exports.PUBLIC_OFFER_QUERY = PUBLIC_OFFER_QUERY;

exports.getOffers = async (req, res) => {
  try {
    // Public route gets only active offers picked for the website; logged-in users get all
    // (?public=1 is what the website asks for, even if the visitor is also logged in to the portal)
    const wantsPublic = !req.user || req.query.public === '1';
    const query = wantsPublic ? PUBLIC_OFFER_QUERY : {};
    const offers = await Offer.find(query).sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get offers' });
  }
};

exports.createOffer = async (req, res) => {
  try {
    const { titleEn, titleTa, descriptionEn, descriptionTa, photo, photos, discountType, discountValue, active, showOnWebsite } = req.body;
    const badDiscount = discountError(discountType, discountValue);
    if (badDiscount) return res.status(400).json({ success: false, message: badDiscount });
    if (!titleEn || !String(titleEn).trim()) {
      return res.status(400).json({ success: false, message: 'Title (English) required' });
    }
    if (await Offer.exists({ titleEn: sameNameRegex(titleEn) })) {
      return res.status(400).json({ success: false, message: 'An offer with this title already exists' });
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
      showOnWebsite: showOnWebsite !== false,
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
    const badDiscount = discountError(rest.discountType, rest.discountValue);
    if (badDiscount) return res.status(400).json({ success: false, message: badDiscount });
    if (rest.titleEn !== undefined) {
      if (!String(rest.titleEn).trim()) {
        return res.status(400).json({ success: false, message: 'Title (English) required' });
      }
      if (await Offer.exists({ _id: { $ne: req.params.id }, titleEn: sameNameRegex(rest.titleEn) })) {
        return res.status(400).json({ success: false, message: 'An offer with this title already exists' });
      }
    }
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
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete offer' });
  }
};

// PUT /api/offers/website-selection   body: { offerIds: [...] }
// The listed offers are shown on the public website; every other offer is hidden from it.
exports.saveWebsiteSelection = async (req, res) => {
  try {
    const { offerIds } = req.body || {};
    if (!Array.isArray(offerIds) || !offerIds.every(isValidObjectId)) {
      return res.status(400).json({ success: false, message: 'offerIds must be a list of offer IDs' });
    }
    await Offer.updateMany({ _id: { $in: offerIds } }, { showOnWebsite: true });
    await Offer.updateMany({ _id: { $nin: offerIds } }, { showOnWebsite: false });
    const offers = await Offer.find({}).sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save website offers' });
  }
};

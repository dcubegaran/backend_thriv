const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const UploadedImage = require('../models/UploadedImage');

const TYPE_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// POST /api/upload - saves the image in the database and returns its served path
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const contentType = TYPE_BY_EXT[ext] || req.file.mimetype || 'image/jpeg';
    const image = await UploadedImage.create({
      data: req.file.buffer,
      contentType,
      size: req.file.size,
      originalName: String(req.file.originalname || '').slice(0, 200),
      uploadedBy: req.user._id,
    });
    res.json({ success: true, url: `/uploads/db/${image._id}` });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ success: false, message: 'Failed to save image' });
  }
});

// GET /uploads/db/:id - serves an image saved by the route above (public: used on the website)
async function serveImage(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
    // Not .lean(): Mongoose then gives `data` as a Buffer of exactly the stored bytes
    const image = await UploadedImage.findById(req.params.id);
    if (!image) return res.status(404).end();
    res.set({
      'Content-Type': image.contentType,
      'Content-Length': image.data.length,
      // An id never points to a different image, so browsers can keep it
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.send(Buffer.from(image.data));
  } catch (err) {
    res.status(500).end();
  }
}

module.exports = router;
module.exports.serveImage = serveImage;

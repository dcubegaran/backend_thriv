const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const path = require('path');
const upload = require('../middleware/upload');

// Upload an image; return the served path
router.post('/', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: filePath });
});

module.exports = router;

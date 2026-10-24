const multer = require('multer');
const path = require('path');

// Files are kept in memory and then saved to the database (see routes/upload.js),
// because the hosting's disk is wiped on every restart.
const storage = multer.memoryStorage();

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  // Phones sometimes send no extension or a generic name, so accept a known image type either way
  if (ALLOWED_EXT.includes(ext) || ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Only JPG, PNG, WEBP images are allowed');
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = upload;

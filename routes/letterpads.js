const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sharp = require('sharp');
const { protect, requireRole } = require('../middleware/auth');
const LetterPad = require('../models/LetterPad');

const router = express.Router();
const roles = requireRole('superadmin', 'admin', 'supervisor');
const uploadRoot = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const letterpadDir = path.join(uploadRoot, 'letterpads');
const defaultSource = path.join(__dirname, '..', 'assets', 'letterhead.jpg');
const defaultFilename = 'default.jpg';
const maxFileSize = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (['.jpg', '.jpeg'].includes(extension)) {
      callback(null, true);
      return;
    }
    callback(new Error('Upload one JPG/JPEG image only'));
  },
});

const parseUpload = (req, res, next) => upload.single('letterPad')(req, res, (err) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Letter pad must be 5 MB or smaller'
      : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Upload one JPG/JPEG image only'
        : err.message;
    return res.status(400).json({ success: false, message });
  }
  next();
});

async function ensureLetterpadDirectory() {
  try {
    await fs.mkdir(letterpadDir, { recursive: true });
  } catch (err) {
    return false;
  }
  try {
    await fs.access(defaultSource);
    await fs.copyFile(defaultSource, path.join(letterpadDir, defaultFilename), require('fs').constants.COPYFILE_EXCL);
  } catch (err) {
    // The source image or writable mirror may be unavailable; MongoDB remains authoritative.
  }
  return true;
}

function toLetterpad(filename, name, isDefault = false) {
  return { filename, name, isDefault, url: `/uploads/letterpads/${filename}` };
}

router.use(protect, roles);

router.get('/', async (req, res) => {
  try {
    await ensureLetterpadDirectory();
    const savedPads = await LetterPad.find({}).sort({ createdAt: -1 });
    for (const pad of savedPads) {
      const target = path.join(letterpadDir, pad.filename);
      try {
        await fs.access(target);
      } catch {
        try { await fs.writeFile(target, Buffer.from(pad.data), { flag: 'wx' }); } catch (err) { /* MongoDB remains the durable copy. */ }
      }
    }
    const letterPads = [
      { ...toLetterpad(defaultFilename, 'Default company letter pad', true) },
      ...savedPads.map(pad => ({
        ...toLetterpad(pad.filename, pad.originalName, false),
        createdAt: pad.createdAt.toISOString(),
      })),
    ];
    res.json({ success: true, letterPads });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list letter pads' });
  }
});

router.post('/', parseUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose one JPG/JPEG image' });
    let metadata;
    try {
      metadata = await sharp(req.file.buffer, { animated: false }).metadata();
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Letter pad must be a valid single-page JPG/JPEG image' });
    }
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || (metadata.pages && metadata.pages !== 1)) {
      return res.status(400).json({ success: false, message: 'Letter pad must be a valid single-page JPG/JPEG image' });
    }

    const label = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'Letter-pad';
    const filename = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${label}.jpg`;
    await LetterPad.create({
      filename,
      originalName: String(req.file.originalname || label).slice(0, 200),
      data: req.file.buffer,
      uploadedBy: req.user._id,
    });
    if (await ensureLetterpadDirectory()) {
      try { await fs.writeFile(path.join(letterpadDir, filename), req.file.buffer, { flag: 'wx' }); } catch (err) { /* MongoDB remains the durable copy. */ }
    }
    res.status(201).json({ success: true, letterPad: toLetterpad(filename, req.file.originalname) });
  } catch (err) {
    console.error('Letter pad upload failed:', err);
    res.status(500).json({ success: false, message: 'Failed to save letter pad' });
  }
});

router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || filename === defaultFilename || path.basename(filename) !== filename) {
      return res.status(400).json({ success: false, message: 'This letter pad cannot be deleted' });
    }
    const pad = await LetterPad.findOneAndDelete({ filename });
    if (!pad) return res.status(404).json({ success: false, message: 'Letter pad not found' });
    try {
      await fs.unlink(path.join(letterpadDir, filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    res.json({ success: true, message: 'Letter pad deleted' });
  } catch (err) {
    console.error('Letter pad delete failed:', err);
    res.status(500).json({ success: false, message: 'Failed to delete letter pad' });
  }
});

module.exports = router;
module.exports.serveImage = async (req, res) => {
  const { filename } = req.params;
  if (typeof filename !== 'string' || path.basename(filename) !== filename || !/^[-\w]+\.jpe?g$/i.test(filename)) {
    return res.status(404).end();
  }
  if (filename === defaultFilename) return res.sendFile(defaultSource);
  try {
    const pad = await LetterPad.findOne({ filename }).select('data');
    if (!pad) return res.status(404).end();
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': pad.data.length,
      'Cache-Control': 'private, max-age=3600',
    });
    res.send(Buffer.from(pad.data));
  } catch (err) {
    res.status(500).end();
  }
};

const path = require('path');
const fs = require('fs');

// Company letter pad (assets/letterhead.jpg, an A4 portrait image of the letter pad PDF) drawn behind
// every page of the reports and quotations. Agreements are made in the browser and don't use it.
const LETTERHEAD_FILE = path.join(__dirname, '..', 'assets', 'letterhead.jpg');
const HAS_LETTERHEAD = fs.existsSync(LETTERHEAD_FILE);
const UPLOADED_LETTERHEADS_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'letterpads');

// Content area on an A4 portrait page (points), clear of the letter pad's header (name, address,
// logo and rule end at ~110pt) and the wave at the bottom (starts at ~720pt on the right).
// Frozen: pdfkit keeps a reference to the margins object, so each document must get its own copy
// (see letterheadMargins) - otherwise one PDF changing its margins would change every later PDF.
const LETTERHEAD_MARGINS = Object.freeze({ top: 128, bottom: 160, left: 50, right: 50 });
const letterheadMargins = () => ({ ...LETTERHEAD_MARGINS });
// Baseline for small footer text (page numbers), just above the wave
const LETTERHEAD_FOOTER_Y = 700;

async function loadLetterhead(selection) {
  if (selection === undefined) return HAS_LETTERHEAD ? LETTERHEAD_FILE : null;
  if (!selection || selection === 'blank') return null;
  if (typeof selection !== 'string' || path.basename(selection) !== selection || !/^[-\w]+\.jpe?g$/i.test(selection)) {
    throw new Error('Invalid letter pad selection');
  }
  if (selection === 'default.jpg' && HAS_LETTERHEAD) return LETTERHEAD_FILE;

  const selectedFile = path.join(UPLOADED_LETTERHEADS_DIR, selection);
  if (fs.existsSync(selectedFile)) return selectedFile;

  try {
    const LetterPad = require('../models/LetterPad');
    const letterPad = await LetterPad.findOne({ filename: selection }).select('data');
    if (letterPad) return Buffer.from(letterPad.data);
  } catch (err) {
    throw err;
  }
  throw new Error('Selected letter pad was not found');
}

function drawLetterhead(doc, file) {
  if (!file) return;
  const { x, y } = doc;
  doc.image(file, 0, 0, { width: doc.page.width, height: doc.page.height });
  doc.x = x;
  doc.y = y;
}

// Draws the letter pad on the current page and on every page added later
function useLetterhead(doc, file) {
  drawLetterhead(doc, file);
  doc.on('pageAdded', () => drawLetterhead(doc, file));
}

// Part of a blank A4 page the reports use (from the top margin down to the page numbers), and the
// part of a letter pad page that is clear of its header and the wave at the bottom.
const BLANK_BAND = { top: 40, bottom: 832 };
const PAD_BAND = { top: 118, bottom: 712 };

// For reports laid out with the blank page's margins: draws the letter pad behind every page and
// shrinks the whole blank-page layout to fit inside the letter pad, so a report has the same pages
// (same page breaks, same content on each page) with or without a letter pad - just smaller.
// The scale is applied once at the start of each page and stays for that page, so the page
// numbers added later (switchToPage) are scaled the same way.
function useLetterheadScaled(doc, file) {
  if (!file) return;
  const scale = (PAD_BAND.bottom - PAD_BAND.top) / (BLANK_BAND.bottom - BLANK_BAND.top);
  const apply = () => {
    drawLetterhead(doc, file);
    const dx = (doc.page.width * (1 - scale)) / 2; // centred left to right
    const dy = PAD_BAND.top - BLANK_BAND.top * scale;
    doc.transform(scale, 0, 0, scale, dx, dy);
  };
  apply();
  doc.on('pageAdded', apply);
}

module.exports = {
  HAS_LETTERHEAD, LETTERHEAD_MARGINS, LETTERHEAD_FOOTER_Y, letterheadMargins, loadLetterhead, useLetterhead, useLetterheadScaled,
};

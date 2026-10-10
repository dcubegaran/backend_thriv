const path = require('path');
const fs = require('fs');

// Company letter pad (assets/letterhead.jpg, an A4 portrait image of the letter pad PDF) drawn behind
// every page of the reports and quotations. Agreements are made in the browser and don't use it.
const LETTERHEAD_FILE = path.join(__dirname, '..', 'assets', 'letterhead.jpg');
const HAS_LETTERHEAD = fs.existsSync(LETTERHEAD_FILE);

// Content area on an A4 portrait page (points), clear of the letter pad's header (name, address,
// logo and rule end at ~110pt) and the wave at the bottom (starts at ~720pt on the right).
// Frozen: pdfkit keeps a reference to the margins object, so each document must get its own copy
// (see letterheadMargins) - otherwise one PDF changing its margins would change every later PDF.
const LETTERHEAD_MARGINS = Object.freeze({ top: 128, bottom: 160, left: 50, right: 50 });
const letterheadMargins = () => ({ ...LETTERHEAD_MARGINS });
// Baseline for small footer text (page numbers), just above the wave
const LETTERHEAD_FOOTER_Y = 700;

function drawLetterhead(doc) {
  if (!HAS_LETTERHEAD) return;
  const { x, y } = doc;
  doc.image(LETTERHEAD_FILE, 0, 0, { width: doc.page.width, height: doc.page.height });
  doc.x = x;
  doc.y = y;
}

// Draws the letter pad on the current page and on every page added later
function useLetterhead(doc) {
  drawLetterhead(doc);
  doc.on('pageAdded', () => drawLetterhead(doc));
}

module.exports = { HAS_LETTERHEAD, LETTERHEAD_MARGINS, LETTERHEAD_FOOTER_Y, letterheadMargins, useLetterhead };

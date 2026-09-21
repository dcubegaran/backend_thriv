const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Format number as Indian currency (e.g. ₹10,00,000)
 */
function formatINR(amount) {
  if (typeof amount !== 'number') return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

/**
 * Format date as "14 Sep 2026"
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---- Fonts -----------------------------------------------------------------
// The bundled Noto Sans Tamil files only contain Tamil letters and the rupee sign
// (no Latin letters, digits or punctuation), while Helvetica has no Tamil and no
// rupee sign. So text is split into runs: Tamil script and "₹" use the Tamil font,
// everything else uses Helvetica.
const FONT_DIR = path.join(__dirname, '..', 'fonts');
const SYSTEM_TAMIL_FALLBACKS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf',
  '/usr/share/fonts/truetype/tlwg/Loma.ttf',
  'C:/Windows/Fonts/Latha.ttf',
  'C:/Windows/Fonts/tam.ttf',
];
const TAMIL_REGULAR_FILE = path.join(FONT_DIR, 'noto-sans-tamil-tamil-400.ttf');
const TAMIL_BOLD_FILE = path.join(FONT_DIR, 'noto-sans-tamil-tamil-700.ttf');
const firstExisting = paths => paths.find(p => fs.existsSync(p));
const TAMIL_FONT_REGULAR = firstExisting([TAMIL_REGULAR_FILE, TAMIL_BOLD_FILE, ...SYSTEM_TAMIL_FALLBACKS]);
const TAMIL_FONT_BOLD = firstExisting([TAMIL_BOLD_FILE, TAMIL_REGULAR_FILE, ...SYSTEM_TAMIL_FALLBACKS]);
const HAS_TAMIL_FONT = Boolean(TAMIL_FONT_REGULAR && TAMIL_FONT_BOLD);

// Tamil block, zero-width joiners used inside Tamil words, and the rupee sign
const INDIC_CHAR_RE = /[\u0B80-\u0BFF\u200C\u200D\u20B9]/;
const RUN_RE = /[\u0B80-\u0BFF\u200C\u200D\u20B9]+|[^\u0B80-\u0BFF\u200C\u200D\u20B9]+/g;

/**
 * Generate a professional quotation PDF
 * quoteData: { quoteNumber, date, customer, sqftRate, baseAmount, offersApplied, finalAmount, terms, language, company }
 */
async function generateQuotePDF(quoteData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const {
      quoteNumber, date, customer, sqftRate, baseAmount,
      offersApplied = [], finalAmount, terms, language, company = {}
    } = quoteData;

    const isTamil = language === 'ta';

    // Colors
    const darkColor = '#1a1a1a';
    const accentColor = '#2c4a6e';
    const borderColor = '#cccccc';
    const mutedColor = '#555555';

    // ---- Text helpers (font is chosen per run, see the notes on fonts above) ----
    const latinFont = bold => (bold ? 'Helvetica-Bold' : 'Helvetica');
    const indicFont = bold => (bold ? TAMIL_FONT_BOLD : TAMIL_FONT_REGULAR);
    const isIndicRun = run => INDIC_CHAR_RE.test(run);

    // Without any Tamil-capable font the rupee sign can't be drawn, so spell it out
    const prepare = value => {
      const str = String(value ?? '');
      return HAS_TAMIL_FONT ? str : str.replace(/\u20B9/g, 'Rs. ');
    };
    const needsIndicFont = str => HAS_TAMIL_FONT && INDIC_CHAR_RE.test(str);

    const useRunFont = (run, size, bold) => {
      doc.font(isIndicRun(run) ? indicFont(bold) : latinFont(bold)).fontSize(size);
    };
    const ascent = (font, size) => {
      doc.font(font).fontSize(size);
      return ((doc._font && doc._font.ascender) || 0) / 1000 * size;
    };

    const runsOf = str => str.match(RUN_RE) || [];
    const widthOf = (value, size, bold = false) => {
      const str = prepare(value);
      if (!needsIndicFont(str)) {
        doc.font(latinFont(bold)).fontSize(size);
        return doc.widthOfString(str);
      }
      return runsOf(str).reduce((sum, run) => {
        useRunFont(run, size, bold);
        return sum + doc.widthOfString(run);
      }, 0);
    };

    // Draws one line made of Latin / Tamil runs, keeping them on a common baseline
    const drawLine = (str, x, y, size, bold) => {
      const latinAscent = ascent(latinFont(bold), size);
      let cx = x;
      runsOf(str).forEach(run => {
        const indic = isIndicRun(run);
        const offset = indic ? latinAscent - ascent(indicFont(bold), size) : 0;
        useRunFont(run, size, bold);
        doc.text(run, cx, y + offset, { lineBreak: false });
        cx += doc.widthOfString(run);
      });
    };

    const wrapLines = (str, maxWidth, size, bold) => {
      const lines = [];
      str.split('\n').forEach(paragraph => {
        let line = '';
        let lineWidth = 0;
        paragraph.split(/(\s+)/).forEach(token => {
          if (!token) return;
          const isSpace = token.trim() === '';
          const tokenWidth = widthOf(token, size, bold);
          if (!isSpace && line && lineWidth + tokenWidth > maxWidth) {
            lines.push(line.trimEnd());
            line = '';
            lineWidth = 0;
          }
          if (isSpace && !line) return;
          line += token;
          lineWidth += tokenWidth;
        });
        lines.push(line.trimEnd());
      });
      return lines;
    };

    /**
     * Write text at (x, y). Returns the y just below the text.
     * options: { size, bold, color, width, align, lineGap }
     * Latin-only text goes straight through pdfkit; text with Tamil or "₹" is laid out run by run.
     */
    const write = (value, x, y, { size = 10, bold = false, color = darkColor, width, align = 'left', lineGap = 0 } = {}) => {
      const str = prepare(value);
      doc.fillColor(color);

      if (!needsIndicFont(str)) {
        const options = { align, lineGap };
        if (width !== undefined) options.width = width;
        doc.font(latinFont(bold)).fontSize(size).text(str, x, y, options);
        return doc.y;
      }

      const boxWidth = width !== undefined ? width : doc.page.width - doc.page.margins.right - x;
      const lineHeight = Math.max(
        doc.font(latinFont(bold)).fontSize(size).currentLineHeight(true),
        doc.font(indicFont(bold)).fontSize(size).currentLineHeight(true),
      ) + lineGap;
      const lines = wrapLines(str, boxWidth, size, bold);
      let ly = y;
      lines.forEach(line => {
        // Long text continues on a new page, as pdfkit does for plain text
        if (ly + lineHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          doc.fillColor(color);
          ly = doc.page.margins.top;
        }
        const lineWidth = widthOf(line, size, bold);
        let lx = x;
        if (align === 'right') lx = x + boxWidth - lineWidth;
        else if (align === 'center') lx = x + (boxWidth - lineWidth) / 2;
        drawLine(line, lx, ly, size, bold);
        ly += lineHeight;
      });
      doc.y = ly;
      return ly;
    };

    // ---- Header ----
    doc.rect(0, 0, doc.page.width, 110).fill('#f5f5f0');

    // Company name
    write(company.nameEn || 'Balu Hari Builders', 50, 25, { size: 22, bold: true, color: accentColor, align: 'center' });

    if (isTamil && company.nameTa) {
      write(company.nameTa, 50, 50, { size: 14, color: accentColor, align: 'center' });
    }

    write(
      [company.address, company.phone, company.email].filter(Boolean).join('  |  '),
      50, 72, { size: 10, color: mutedColor, align: 'center' }
    );

    // Divider
    doc.moveTo(50, 115).lineTo(doc.page.width - 50, 115).strokeColor(accentColor).lineWidth(2).stroke();

    // ---- Quotation Title ----
    doc.moveDown(0.5);
    const titleText = isTamil ? 'மதிப்பீடு' : 'QUOTATION';
    write(titleText, 50, 130, { size: 16, bold: true, color: accentColor, align: 'center' });

    // Quote number and date
    write(isTamil ? `மதிப்பீடு எண்: ${quoteNumber}` : `Quote No: ${quoteNumber}`, 50, 158, { size: 10 });
    write(isTamil ? `தேதி: ${formatDate(date)}` : `Date: ${formatDate(date)}`, doc.page.width - 200, 158, { size: 10, align: 'right' });

    // Divider
    doc.moveTo(50, 175).lineTo(doc.page.width - 50, 175).strokeColor(borderColor).lineWidth(1).stroke();

    // ---- Customer Details ----
    const custLabel = isTamil ? 'வாடிக்கையாளர் விவரங்கள்' : 'Customer Details';
    write(custLabel, 50, 185, { size: 11, bold: true, color: accentColor });

    let cy = 202;
    const addField = (label, value) => {
      // bold label followed by the regular value on the same line
      const labelText = label + ': ';
      write(labelText, 50, cy, { size: 10, bold: true });
      write(value || '-', 50 + widthOf(labelText, 10, true), cy, { size: 10 });
      cy += 16;
    };

    addField(isTamil ? 'பெயர்' : 'Name', customer.name);
    addField(isTamil ? 'நகரம்' : 'City', customer.city);
    addField(isTamil ? 'தொலைபேசி' : 'Phone', customer.phone);
    addField(isTamil ? 'சதுர அடி' : 'Sqft', String(customer.sqft));

    cy += 10;

    // Divider
    doc.moveTo(50, cy).lineTo(doc.page.width - 50, cy).strokeColor(borderColor).lineWidth(1).stroke();
    cy += 15;

    // ---- Construction Estimate ----
    const estLabel = isTamil ? 'கட்டிட மதிப்பீடு' : 'Construction Estimate';
    write(estLabel, 50, cy, { size: 11, bold: true, color: accentColor });
    cy += 20;

    const tableLeft = 50;
    const tableRight = doc.page.width - 50;
    const colDesc = 320;

    const drawRow = (label, value, bold = false) => {
      write(label, tableLeft, cy, { size: 10, bold, width: colDesc - tableLeft });
      write(formatINR(value), colDesc, cy, { size: 10, bold, width: tableRight - colDesc, align: 'right' });
      cy += 18;
    };

    const baseLabel = isTamil
      ? `அடிப்படை மதிப்பு (${customer.sqft} sqft × ${formatINR(sqftRate || (baseAmount / customer.sqft))})`
      : `Base Amount (${customer.sqft} sqft × ${formatINR(sqftRate || (baseAmount / customer.sqft))})`;
    drawRow(baseLabel, baseAmount);

    if (offersApplied && offersApplied.length > 0) {
      offersApplied.forEach(offer => {
        if (offer.discountApplied > 0) {
          const offerLabel = isTamil && offer.titleTa
            ? `${offer.titleTa} (${isTamil ? 'தள்ளுபடி' : 'Discount'})`
            : `${offer.titleEn} (Discount)`;
          drawRow(`  - ${offerLabel}`, -offer.discountApplied);
        }
      });
    }

    // Total line
    doc.moveTo(tableLeft, cy - 4).lineTo(tableRight, cy - 4).strokeColor(borderColor).lineWidth(1).stroke();
    const finalLabel = isTamil ? 'இறுதி மொத்தம்' : 'Final Amount';
    drawRow(finalLabel, finalAmount, true);

    doc.moveTo(tableLeft, cy - 2).lineTo(tableRight, cy - 2).strokeColor(accentColor).lineWidth(2).stroke();

    cy += 20;

    // ---- Terms & Conditions ----
    if (terms && terms.trim()) {
      if (cy > doc.page.height - 200) {
        doc.addPage();
        cy = 50;
      }
      doc.moveTo(50, cy).lineTo(doc.page.width - 50, cy).strokeColor(borderColor).lineWidth(1).stroke();
      cy += 15;

      const termsLabel = isTamil ? 'விதிமுறைகள் மற்றும் நிபந்தனைகள்' : 'Terms & Conditions';
      write(termsLabel, 50, cy, { size: 11, bold: true, color: accentColor });
      cy += 18;

      cy = write(terms, 50, cy, { size: 9, width: doc.page.width - 100, lineGap: 3 }) + 20;
    }

    // ---- Footer ----
    // If the terms ran down to the footer area, give the footer its own page instead of overlapping
    if (cy > doc.page.height - 110) doc.addPage();
    // Drawn inside the bottom margin, so switch the margin off to stop pdfkit adding a blank page
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 100;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(borderColor).lineWidth(1).stroke();

    write(isTamil ? 'அங்கீகரிக்கப்பட்டது:' : 'Authorized By:', 50, footerY + 15, { size: 9, color: mutedColor });
    write(company.nameEn || 'Balu Hari Builders', 50, footerY + 30, { size: 10, bold: true, color: accentColor });

    write(
      isTamil ? 'இந்த மதிப்பீடு கணினி மூலம் உருவாக்கப்பட்டது.' : 'This is a computer-generated quotation.',
      50, footerY + 60, { size: 8, color: mutedColor, align: 'center', width: doc.page.width - 100 }
    );

    doc.end();
  });
}

module.exports = { generateQuotePDF };

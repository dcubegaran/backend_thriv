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

/**
 * Generate a professional quotation PDF
 * quoteData: { quoteNumber, date, customer, sqftRate, baseAmount, offersApplied, finalAmount, terms, language, company }
 */
async function generateQuotePDF(quoteData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    const fallbackTamilFonts = [
      path.join(__dirname, '..', 'fonts', 'noto-sans-tamil-tamil-700.ttf'),
      path.join(__dirname, '..', 'fonts', 'noto-sans-tamil-tamil-400.ttf'),
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf',
      '/usr/share/fonts/truetype/tlwg/Loma.ttf',
      'C:/Windows/Fonts/Latha.ttf',
      'C:/Windows/Fonts/tam.ttf',
    ];
    const tamilFont = fallbackTamilFonts.find(fontPath => fs.existsSync(fontPath));
    const applyLanguageFont = (size, weight = 'regular') => {
      if (isTamil && tamilFont) {
        doc.font(tamilFont).fontSize(size);
      } else {
        doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      }
      return doc;
    };

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

    // ---- Header ----
    doc.rect(0, 0, doc.page.width, 110).fill('#f5f5f0');

    // Company name
    applyLanguageFont(22, 'bold').fillColor(accentColor)
       .text(company.nameEn || 'Balu Hari Builders', 50, 25, { align: 'center' });

    if (isTamil && company.nameTa) {
      applyLanguageFont(14).fillColor(accentColor)
         .text(company.nameTa, 50, 50, { align: 'center' });
    }

    applyLanguageFont(10).fillColor(mutedColor)
       .text(
         [company.address, company.phone, company.email].filter(Boolean).join('  |  '),
         50, 72, { align: 'center' }
       );

    // Divider
    doc.moveTo(50, 115).lineTo(doc.page.width - 50, 115).strokeColor(accentColor).lineWidth(2).stroke();

    // ---- Quotation Title ----
    doc.moveDown(0.5);
    const titleText = isTamil ? 'மதிப்பீடு' : 'QUOTATION';
    applyLanguageFont(16, 'bold').fillColor(accentColor)
       .text(titleText, 50, 130, { align: 'center' });

    // Quote number and date
    applyLanguageFont(10).fillColor(darkColor)
       .text(isTamil ? `மதிப்பீடு எண்: ${quoteNumber}` : `Quote No: ${quoteNumber}`, 50, 158)
       .text(isTamil ? `தேதி: ${formatDate(date)}` : `Date: ${formatDate(date)}`, doc.page.width - 200, 158, { align: 'right' });

    // Divider
    doc.moveTo(50, 175).lineTo(doc.page.width - 50, 175).strokeColor(borderColor).lineWidth(1).stroke();

    // ---- Customer Details ----
    const custLabel = isTamil ? 'வாடிக்கையாளர் விவரங்கள்' : 'Customer Details';
    applyLanguageFont(11, 'bold').fillColor(accentColor)
       .text(custLabel, 50, 185);

    applyLanguageFont(10).fillColor(darkColor);
    let cy = 202;
    const addField = (label, value) => {
      applyLanguageFont(10, 'bold').text(label + ': ', 50, cy, { continued: true });
      applyLanguageFont(10).text(value || '-');
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
    applyLanguageFont(11, 'bold').fillColor(accentColor).text(estLabel, 50, cy);
    cy += 20;

    const tableLeft = 50;
    const tableRight = doc.page.width - 50;
    const colDesc = 320;

    const drawRow = (label, value, bold = false) => {
      if (bold) {
        applyLanguageFont(10, 'bold').fillColor(darkColor);
      } else {
        applyLanguageFont(10).fillColor(darkColor);
      }
      doc.text(label, tableLeft, cy, { width: colDesc - tableLeft });
      doc.text(formatINR(value), colDesc, cy, { width: tableRight - colDesc, align: 'right' });
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
      applyLanguageFont(11, 'bold').fillColor(accentColor).text(termsLabel, 50, cy);
      cy += 18;

      applyLanguageFont(9).fillColor(darkColor).text(terms, 50, cy, { width: doc.page.width - 100, lineGap: 3 });

      cy = doc.y + 20;
    }

    // ---- Footer ----
    const footerY = doc.page.height - 100;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(borderColor).lineWidth(1).stroke();

    applyLanguageFont(9).fillColor(mutedColor)
       .text(isTamil ? 'அங்கீகரிக்கப்பட்டது:' : 'Authorized By:', 50, footerY + 15);
    applyLanguageFont(10, 'bold').fillColor(accentColor)
       .text(company.nameEn || 'Balu Hari Builders', 50, footerY + 30);

    applyLanguageFont(8).fillColor(mutedColor)
       .text(
         isTamil ? 'இந்த மதிப்பீடு கணினி மூலம் உருவாக்கப்பட்டது.' : 'This is a computer-generated quotation.',
         50, footerY + 60, { align: 'center', width: doc.page.width - 100 }
       );

    doc.end();
  });
}

module.exports = { generateQuotePDF };

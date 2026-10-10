const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { LETTERHEAD_MARGINS, LETTERHEAD_FOOTER_Y, useLetterhead } = require('./letterhead');

const COLORS = {
  dark: '#1a1a1a',
  accent: '#2c4a6e',
  border: '#cccccc',
  muted: '#555555',
  band: '#f5f5f0',
  headBg: '#e8eef5',
  danger: '#b42318',
  ok: '#1f8a4c',
};

const PAGE_MARGIN = 50;
// Pages carry the company letter pad: content starts below its header and stops above its bottom wave
const TOP = LETTERHEAD_MARGINS.top;
const BOTTOM_LIMIT = LETTERHEAD_MARGINS.bottom; // distance from the page bottom kept clear

// The bundled Tamil font has Tamil glyphs only (no Latin letters or digits),
// so Tamil runs use it and everything else uses Helvetica.
const TAMIL_RE = /[஀-௿]/;
const TAMIL_SPLIT_RE = /[஀-௿]+|[^஀-௿]+/g;
const tamilRegular = path.join(__dirname, '..', 'fonts', 'noto-sans-tamil-tamil-400.ttf');
const tamilBold = path.join(__dirname, '..', 'fonts', 'noto-sans-tamil-tamil-700.ttf');
const hasTamilFont = fs.existsSync(tamilRegular) && fs.existsSync(tamilBold);

// Helvetica has no rupee glyph, so amounts are written as "Rs."
function formatAmount(amount) {
  const n = Number(amount) || 0;
  return `${n < 0 ? '-' : ''}Rs. ${Math.abs(n).toLocaleString('en-IN')}`;
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function formatDays(days) {
  return String(Number(Number(days).toFixed(2)));
}

/**
 * Generate the site report PDF.
 * data: {
 *   company, generatedAt, range: { start, end },
 *   site: { siteName, location, ownerName, ownerPhone, sqft, status, startDate, endDate },
 *   workers: [{ workerName, labourType, days, advancePaid, totalSalary, remaining }],
 *   attendance: [{ date, entries: [{ labourType, days }] }],  // one item per date, ascending
 *   credits: [{ date, shopName, amount, status }],
 * }
 */
function generateSiteReportPDF(data) {
  return new Promise((resolve, reject) => {
    const {
      company = 'Balu Hari Builders', generatedAt = new Date(), range,
      site, workers = [], attendance = [], credits = [],
    } = data;

    const doc = new PDFDocument({
      margins: { top: TOP, bottom: BOTTOM_LIMIT, left: PAGE_MARGIN, right: PAGE_MARGIN },
      size: 'A4',
      bufferPages: true,
      info: { Title: `Site Report - ${site.siteName}`, Author: company },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    useLetterhead(doc);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const left = PAGE_MARGIN;
    const right = pageWidth - PAGE_MARGIN;
    let y = TOP;

    const latinFont = bold => (bold ? 'Helvetica-Bold' : 'Helvetica');
    const tamilFont = bold => (bold ? tamilBold : tamilRegular);

    // Writes text at (x, y), switching font per Tamil / non-Tamil run
    const text = (value, x, yPos, { size = 10, bold = false, color = COLORS.dark, ...options } = {}) => {
      const str = String(value ?? '');
      doc.fillColor(color);
      if (!hasTamilFont || !TAMIL_RE.test(str)) {
        doc.font(latinFont(bold)).fontSize(size).text(str, x, yPos, options);
        return;
      }
      const runs = str.match(TAMIL_SPLIT_RE);
      runs.forEach((run, i) => {
        const isLast = i === runs.length - 1;
        doc.font(TAMIL_RE.test(run) ? tamilFont(bold) : latinFont(bold)).fontSize(size);
        if (i === 0) doc.text(run, x, yPos, { ...options, continued: !isLast });
        else doc.text(run, { ...options, continued: !isLast });
      });
    };

    const measure = (value, width, size = 10, bold = false, lineGap = 0) => {
      const str = String(value ?? '');
      const font = hasTamilFont && TAMIL_RE.test(str) ? tamilFont(bold) : latinFont(bold);
      doc.font(font).fontSize(size);
      return doc.heightOfString(str, { width, lineGap });
    };

    const hr = (yPos, color = COLORS.border, width = 1) => {
      doc.moveTo(left, yPos).lineTo(right, yPos).strokeColor(color).lineWidth(width).stroke();
    };

    const newPage = () => {
      doc.addPage();
      y = TOP;
    };

    const ensureSpace = height => {
      if (y + height > doc.page.height - BOTTOM_LIMIT) newPage();
    };

    const section = title => {
      ensureSpace(60);
      text(title, left, y, { size: 12, bold: true, color: COLORS.accent });
      y += 18;
      hr(y, COLORS.accent, 1.5);
      y += 10;
    };

    const emptyNote = message => {
      text(message, left, y, { size: 10, color: COLORS.muted });
      y += 22;
    };

    // tall: allow header labels to wrap onto two lines
    const tableHeader = (columns, tall = false) => {
      const height = tall ? 32 : 22;
      doc.rect(left, y, contentWidth, height).fill(COLORS.headBg);
      columns.forEach(col => {
        text(col.label, col.x + 4, y + (tall ? 5 : 6), {
          size: 9.5, bold: true, color: COLORS.accent, width: col.width - 8, align: col.align || 'left', lineBreak: tall,
        });
      });
      y += height;
    };

    // ================= PAGE 1: site details + summary =================
    text('SITE REPORT', left, TOP, { size: 14, bold: true, color: COLORS.accent, width: contentWidth, align: 'center' });
    y = TOP + 28;
    text(`Report Period: ${formatDate(range.start)} to ${formatDate(range.end)}`, left, y, { size: 10, bold: true, width: contentWidth * 0.65, lineBreak: false });
    text(`Generated: ${formatDate(generatedAt)}`, left, y, { size: 9, color: COLORS.muted, width: contentWidth, align: 'right', lineBreak: false });
    y += 30;

    // --- Site details ---
    section('Site Details');
    const kvRows = [
      ['Site Name', site.siteName],
      ['Location', site.location],
      ['Owner', site.ownerName],
      ['Owner Phone', site.ownerPhone],
    ];
    if (site.sqft) kvRows.push(['Area', `${Number(site.sqft).toLocaleString('en-IN')} sqft`]);
    kvRows.push(['Status', site.status === 'active' ? 'Active' : 'Closed']);
    if (site.startDate) kvRows.push(['Start Date', formatDate(site.startDate)]);
    if (site.status === 'closed' && site.endDate) kvRows.push(['End Date', formatDate(site.endDate)]);

    const labelWidth = 120;
    const valueX = left + labelWidth + 10;
    const valueWidth = contentWidth - labelWidth - 10;
    kvRows.forEach(([label, value]) => {
      const rowHeight = Math.max(14, measure(value, valueWidth, 10, true)) + 6;
      text(label, left, y, { size: 10, color: COLORS.muted, width: labelWidth, lineBreak: false });
      text(value || '-', valueX, y, { size: 10, bold: true, width: valueWidth });
      y += rowHeight;
    });
    y += 12;

    // --- Worker-wise attendance (same columns as the Weekly Attendance table on the site page) ---
    section(`Attendance Summary  (${formatDate(range.start)} to ${formatDate(range.end)})`);

    if (workers.length === 0) {
      emptyNote('No labour entries in this range.');
    } else {
      const cols = [
        { label: 'WORKER', x: left, width: 105 },
        { label: 'LABOUR TYPE', x: left + 105, width: 95 },
        { label: 'NO OF DAYS', x: left + 200, width: 55, align: 'center' },
        { label: 'ADVANCE PAID', x: left + 255, width: 75, align: 'right' },
        { label: 'TOTAL SALARY', x: left + 330, width: 85, align: 'right' },
        { label: 'REMAINING TO PAY', x: left + 415, width: contentWidth - 415, align: 'right' },
      ];
      const amountOpts = (col, extra = {}) => ({ size: 9.5, width: col.width - 8, align: 'right', lineBreak: false, ...extra });
      tableHeader(cols, true);

      workers.forEach(row => {
        const rowHeight = Math.max(
          14,
          measure(row.workerName, cols[0].width - 8, 10),
          measure(row.labourType, cols[1].width - 8, 10),
        ) + 12;
        if (y + rowHeight > doc.page.height - BOTTOM_LIMIT) {
          newPage();
          tableHeader(cols, true);
        }
        text(row.workerName, cols[0].x + 4, y + 6, { size: 10, width: cols[0].width - 8 });
        text(row.labourType, cols[1].x + 4, y + 6, { size: 10, width: cols[1].width - 8 });
        text(formatDays(row.days), cols[2].x + 4, y + 6, { size: 10, width: cols[2].width - 8, align: 'center', lineBreak: false });
        text(formatAmount(row.advancePaid), cols[3].x + 4, y + 6, amountOpts(cols[3]));
        text(formatAmount(row.totalSalary), cols[4].x + 4, y + 6, amountOpts(cols[4], { bold: true }));
        text(formatAmount(row.remaining), cols[5].x + 4, y + 6, amountOpts(cols[5], { bold: true, color: row.remaining > 0 ? COLORS.danger : COLORS.ok }));
        y += rowHeight;
        hr(y, '#e5e5e5', 0.5);
      });

      // Totals row
      ensureSpace(30);
      y += 6;
      const sum = key => workers.reduce((total, row) => total + Number(row[key] || 0), 0);
      text('Total', cols[0].x + 4, y, { size: 10, bold: true, width: cols[0].width - 8, lineBreak: false });
      text(formatDays(sum('days')), cols[2].x + 4, y, { size: 10, bold: true, color: COLORS.accent, width: cols[2].width - 8, align: 'center', lineBreak: false });
      text(formatAmount(sum('advancePaid')), cols[3].x + 4, y, amountOpts(cols[3], { bold: true, color: COLORS.accent }));
      text(formatAmount(sum('totalSalary')), cols[4].x + 4, y, amountOpts(cols[4], { bold: true, color: COLORS.accent }));
      text(formatAmount(sum('remaining')), cols[5].x + 4, y, amountOpts(cols[5], { bold: true, color: COLORS.accent }));
      y += 22;
    }
    y += 12;

    // --- Selected period summary ---
    section('Selected Period Summary');
    const totalDays = attendance.reduce((sum, day) => sum + day.entries.reduce((s, e) => s + e.days, 0), 0);
    const openCredits = credits.filter(c => c.status === 'open').reduce((sum, c) => sum + Number(c.amount || 0), 0);
    [
      ['Labour Days Present', formatDays(totalDays)],
      ['Attendance Salary', formatAmount(workers.reduce((sum, w) => sum + Number(w.totalSalary || 0), 0))],
      ['Open Credits', formatAmount(openCredits)],
    ].forEach(([label, value]) => {
      text(label, left + 4, y, { size: 11, width: contentWidth * 0.5, lineBreak: false });
      text(value, left, y, { size: 11, bold: true, width: contentWidth - 4, align: 'right', lineBreak: false });
      y += 20;
      hr(y - 4, '#e5e5e5', 0.5);
    });

    // ================= PAGE 2+: attendance by date =================
    newPage();
    section(`Attendance by Date  (${formatDate(range.start)} to ${formatDate(range.end)})`);

    if (attendance.length === 0) {
      emptyNote('No attendance recorded in this period.');
    } else {
      // Count sits right beside the labour type so the two are easy to read together
      const typeWidth = 300;
      const cols = [
        { label: 'DATE / LABOUR TYPE', x: left, width: typeWidth },
        { label: 'PRESENT', x: left + typeWidth, width: 100, align: 'center' },
      ];
      const dateRowHeight = 24;
      const pageLimit = () => doc.page.height - BOTTOM_LIMIT;
      const freshPageRoom = pageLimit() - TOP - 22;
      const breakWithHeader = () => {
        newPage();
        tableHeader(cols);
      };
      tableHeader(cols);

      attendance.forEach(day => {
        const rows = day.entries.map(entry => ({
          ...entry,
          height: Math.max(14, measure(entry.labourType, cols[0].width - 30, 10)) + 8,
        }));
        const blockHeight = dateRowHeight + rows.reduce((sum, r) => sum + r.height, 0);

        // Keep a date together with its labour types when it fits on one page
        if (y + blockHeight > pageLimit() && blockHeight <= freshPageRoom) breakWithHeader();
        else if (y + dateRowHeight + rows[0].height > pageLimit()) breakWithHeader();

        doc.rect(left, y, contentWidth, dateRowHeight).fill('#f3f6fa');
        text(formatDate(day.date), cols[0].x + 4, y + 7, { size: 10.5, bold: true, color: COLORS.accent, width: cols[0].width - 8, lineBreak: false });
        y += dateRowHeight;

        rows.forEach(row => {
          if (y + row.height > pageLimit()) breakWithHeader();
          text(row.labourType, cols[0].x + 22, y + 5, { size: 10, width: cols[0].width - 30 });
          text(formatDays(row.days), cols[1].x, y + 5, { size: 10, bold: true, width: cols[1].width, align: 'center', lineBreak: false });
          y += row.height;
          hr(y, '#e5e5e5', 0.5);
        });
      });
      y += 10;
    }

    // ================= Credits (last) =================
    y += 10;
    ensureSpace(90);
    section(`Credits  (${formatDate(range.start)} to ${formatDate(range.end)})`);

    if (credits.length === 0) {
      emptyNote('No credits in this period.');
    } else {
      const cols = [
        { label: 'DATE', x: left, width: 100 },
        { label: 'SHOP / VENDOR', x: left + 100, width: 205 },
        { label: 'AMOUNT', x: left + 305, width: 110, align: 'right' },
        { label: 'STATUS', x: left + 415, width: contentWidth - 415, align: 'center' },
      ];
      tableHeader(cols);

      credits.forEach(credit => {
        const rowHeight = Math.max(14, measure(credit.shopName, cols[1].width - 8, 10)) + 12;
        if (y + rowHeight > doc.page.height - BOTTOM_LIMIT) {
          newPage();
          tableHeader(cols);
        }
        const isOpen = credit.status === 'open';
        text(formatDate(credit.date), cols[0].x + 4, y + 6, { size: 10, width: cols[0].width - 8, lineBreak: false });
        text(credit.shopName, cols[1].x + 4, y + 6, { size: 10, width: cols[1].width - 8 });
        text(formatAmount(credit.amount), cols[2].x + 4, y + 6, { size: 10, bold: true, width: cols[2].width - 8, align: 'right', lineBreak: false });
        text(isOpen ? 'Open' : 'Closed', cols[3].x + 4, y + 6, { size: 10, bold: true, color: isOpen ? COLORS.danger : COLORS.ok, width: cols[3].width - 8, align: 'center', lineBreak: false });
        y += rowHeight;
        hr(y, '#e5e5e5', 0.5);
      });

      ensureSpace(50);
      y += 10;
      const totalCredits = credits.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      text('Total Credits', left + 4, y, { size: 10, bold: true, width: 200, lineBreak: false });
      text(formatAmount(totalCredits), left, y, { size: 10, bold: true, width: contentWidth - 4, align: 'right', lineBreak: false });
      y += 18;
      text('Open Credits', left + 4, y, { size: 10, bold: true, color: COLORS.danger, width: 200, lineBreak: false });
      text(formatAmount(openCredits), left, y, { size: 10, bold: true, color: COLORS.danger, width: contentWidth - 4, align: 'right', lineBreak: false });
      y += 18;
    }

    // ================= Footer on every page =================
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins = { ...doc.page.margins, bottom: 0 }; // allow drawing inside the bottom margin without spawning a page
      const footerY = LETTERHEAD_FOOTER_Y;
      text(`${site.siteName}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth * 0.7, lineBreak: false });
      text(`Page ${i + 1} of ${pages.count}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

/**
 * Generic table PDF (the entries tabs on the site page: labour, material, unexpected costs, contracts).
 * The page sends the rows exactly as shown on screen, already formatted.
 * data: { company, siteName, title, subtitle, meta: [string], headers: [string], rows: [[string]],
 *         numeric: [columnIndex], footer: [string] | null }
 */
function generateTablePDF(data) {
  return new Promise((resolve, reject) => {
    const {
      company = 'Balu Hari Builders', siteName = '', title = '', subtitle = '', meta = [],
      headers = [], rows = [], numeric = [], footer = null,
    } = data;

    // Portrait, to match the letter pad behind every page
    const margin = PAGE_MARGIN - 14;
    const doc = new PDFDocument({
      margins: { top: TOP, bottom: BOTTOM_LIMIT, left: margin, right: margin },
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
      info: { Title: `${siteName} - ${title}`, Author: company },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    useLetterhead(doc);

    const left = margin;
    const contentWidth = doc.page.width - margin * 2;
    const bottomLimit = doc.page.height - BOTTOM_LIMIT;
    let y = TOP;

    const latinFont = bold => (bold ? 'Helvetica-Bold' : 'Helvetica');
    const tamilFont = bold => (bold ? tamilBold : tamilRegular);
    // Helvetica has no rupee glyph
    const clean = value => String(value ?? '').replace(/₹\s?/g, 'Rs. ');

    const text = (value, x, yPos, { size = 10, bold = false, color = COLORS.dark, ...options } = {}) => {
      const str = clean(value);
      doc.fillColor(color);
      if (!hasTamilFont || !TAMIL_RE.test(str)) {
        doc.font(latinFont(bold)).fontSize(size).text(str, x, yPos, options);
        return;
      }
      const runs = str.match(TAMIL_SPLIT_RE);
      runs.forEach((run, i) => {
        const isLast = i === runs.length - 1;
        doc.font(TAMIL_RE.test(run) ? tamilFont(bold) : latinFont(bold)).fontSize(size);
        if (i === 0) doc.text(run, x, yPos, { ...options, continued: !isLast });
        else doc.text(run, { ...options, continued: !isLast });
      });
    };
    const fontFor = (str, bold) => (hasTamilFont && TAMIL_RE.test(str) ? tamilFont(bold) : latinFont(bold));
    const measureHeight = (value, width, size, bold = false) => {
      const str = clean(value);
      doc.font(fontFor(str, bold)).fontSize(size);
      return doc.heightOfString(str || ' ', { width });
    };
    const measureWidth = (value, size, bold = false) => {
      const str = clean(value);
      doc.font(fontFor(str, bold)).fontSize(size);
      return doc.widthOfString(str);
    };
    const hr = (yPos, color = COLORS.border, width = 1) => {
      doc.moveTo(left, yPos).lineTo(left + contentWidth, yPos).strokeColor(color).lineWidth(width).stroke();
    };

    // Column widths follow the content, capped so one long column can't squeeze the rest
    const FONT = 9.5;
    const PAD = 8;
    const natural = headers.map((h, i) => {
      const cells = [h, ...rows.map(r => r[i]), ...(footer ? [footer[i]] : [])];
      const widest = Math.max(...cells.map(c => measureWidth(c, FONT, true)));
      return Math.min(Math.max(widest + PAD, 50), 220);
    });
    const scale = contentWidth / natural.reduce((a, b) => a + b, 0);
    const widths = natural.map(w => w * scale);
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const align = i => (numeric.includes(i) ? 'right' : 'left');

    const tableHeader = () => {
      const height = Math.max(...headers.map((h, i) => measureHeight(h.toUpperCase(), widths[i] - PAD, 8.5, true))) + 12;
      doc.rect(left, y, contentWidth, height).fill(COLORS.headBg);
      headers.forEach((h, i) => text(h.toUpperCase(), xs[i] + PAD / 2, y + 6, { size: 8.5, bold: true, color: COLORS.accent, width: widths[i] - PAD, align: align(i) }));
      y += height;
    };

    // ---- Heading ----
    text(title.toUpperCase(), left, TOP, { size: 13, bold: true, color: COLORS.accent, width: contentWidth, align: 'center' });
    y = TOP + 24;
    text(siteName, left, y, { size: 13, bold: true, width: contentWidth });
    y += 20;
    [subtitle, ...meta].filter(Boolean).forEach(line => {
      text(line, left, y, { size: 9.5, color: COLORS.muted, width: contentWidth });
      y += measureHeight(line, contentWidth, 9.5) + 3;
    });
    y += 10;

    // ---- Table ----
    tableHeader();
    if (rows.length === 0) {
      text('No entries', left, y + 10, { size: 10, color: COLORS.muted, width: contentWidth, align: 'center' });
      y += 34;
    }
    rows.forEach((row, rIdx) => {
      const height = Math.max(...row.map((c, i) => measureHeight(c, widths[i] - PAD, FONT))) + 10;
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
        tableHeader();
      }
      if (rIdx % 2 === 1) doc.rect(left, y, contentWidth, height).fill('#f8fafc');
      row.forEach((c, i) => text(c, xs[i] + PAD / 2, y + 5, { size: FONT, width: widths[i] - PAD, align: align(i) }));
      y += height;
      hr(y, '#e5e5e5', 0.5);
    });
    if (footer) {
      const height = Math.max(...footer.map((c, i) => measureHeight(c, widths[i] - PAD, FONT, true))) + 12;
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
      }
      doc.rect(left, y, contentWidth, height).fill(COLORS.band);
      footer.forEach((c, i) => text(c, xs[i] + PAD / 2, y + 6, { size: FONT, bold: true, color: COLORS.accent, width: widths[i] - PAD, align: align(i) }));
      y += height;
    }

    // ---- Footer on every page ----
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins = { ...doc.page.margins, bottom: 0 };
      const footerY = LETTERHEAD_FOOTER_Y;
      text(`${siteName}  |  ${title}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth * 0.75, lineBreak: false });
      text(`Page ${i + 1} of ${pages.count}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateSiteReportPDF, generateTablePDF };


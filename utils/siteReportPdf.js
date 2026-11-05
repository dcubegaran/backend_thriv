const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
// With a letter pad, the blank-page layout is shrunk to fit inside the letter pad (same pages either way)
const { loadLetterhead, useLetterheadScaled } = require('./letterhead');

const COLORS = {
  dark: '#1a1a1a',
  accent: '#2c4a6e',
  border: '#cccccc',
  muted: '#555555',
  band: '#f5f5f0',
  headBg: '#e8eef5',
  danger: '#b42318',
  ok: '#1f8a4c',
  due: '#1d4ed8',
};

// Remaining to pay: red when negative (advance more than salary), green when paid/settled, blue when still due
const remainingColor = row => (row.remaining < 0 ? COLORS.danger : row.paid || row.remaining === 0 ? COLORS.ok : COLORS.due);

const PAGE_MARGIN = 50;
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
async function generateSiteReportPDF(data) {
  const letterheadFile = await loadLetterhead(data.letterhead);
  const margins = { top: 50, bottom: 45, left: PAGE_MARGIN, right: PAGE_MARGIN };
  const TOP = margins.top;
  const BOTTOM_LIMIT = margins.bottom;
  return new Promise((resolve, reject) => {
    const {
      company = 'Balu Hari Builders', generatedAt = new Date(), range,
      site, workers = [], attendance = [], credits = [], letterhead,
    } = data;

    const doc = new PDFDocument({
      margins,
      size: 'A4',
      bufferPages: true,
      info: { Title: `Site Report - ${site.siteName}`, Author: company },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    useLetterheadScaled(doc, letterheadFile);

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

    // Same layout as the Print button on the site page: header, Weekly Attendance,
    // Attendance by date, then the open credits.
    const period = `${formatDate(range.start)} - ${formatDate(range.end)}`;

    // ================= Header =================
    text(site.siteName, left, TOP, { size: 18, bold: true, color: COLORS.accent, width: contentWidth });
    y = TOP + measure(site.siteName, contentWidth, 18, true) + 4;
    const metaLines = [
      `Site Report  ·  ${period}`,
      `${site.location || ''}  ·  Owner: ${site.ownerName || ''} (${site.ownerPhone || ''})`,
      `${company}  ·  Generated on: ${formatDate(generatedAt)}`,
    ];
    metaLines.forEach((line, i) => {
      text(line, left, y, { size: 10, bold: i === 0, color: i === 0 ? COLORS.dark : COLORS.muted, width: contentWidth });
      y += measure(line, contentWidth, 10, i === 0) + 3;
    });
    y += 4;
    hr(y, COLORS.accent, 2);
    y += 16;

    // Writes a table: header, rows (new page + header again when full), optional bold total row
    const drawTable = (cols, rows, { emptyText, total } = {}) => {
      tableHeader(cols, true);
      if (rows.length === 0) {
        text(emptyText || 'No entries', left, y + 8, { size: 10, color: COLORS.muted, width: contentWidth, align: 'center' });
        y += 30;
        return;
      }
      rows.forEach(row => {
        const rowHeight = Math.max(14, ...row.cells.map((c, i) => measure(c, cols[i].width - 8, 10, Boolean(row.bold?.[i])))) + 12;
        if (y + rowHeight > doc.page.height - BOTTOM_LIMIT) {
          newPage();
          tableHeader(cols, true);
        }
        row.cells.forEach((c, i) => text(c, cols[i].x + 4, y + 6, {
          size: 10, bold: Boolean(row.bold?.[i]), color: row.color?.[i] || COLORS.dark, width: cols[i].width - 8, align: cols[i].align || 'left',
        }));
        y += rowHeight;
        hr(y, '#e5e5e5', 0.5);
      });
      if (total) {
        ensureSpace(28);
        doc.rect(left, y, contentWidth, 24).fill(COLORS.band);
        total.forEach((c, i) => text(c, cols[i].x + 4, y + 7, {
          size: 10, bold: true, color: COLORS.accent, width: cols[i].width - 8, align: cols[i].align || 'left', lineBreak: false,
        }));
        y += 24;
      }
    };

    // ================= Weekly Attendance =================
    section('Weekly Attendance');
    const workerRows = [...workers].sort((a, b) => String(a.workerName).localeCompare(String(b.workerName)));
    const sum = key => workerRows.reduce((total, row) => total + Number(row[key] || 0), 0);
    drawTable([
      { label: 'WORKER', x: left, width: 105 },
      { label: 'LABOUR TYPE', x: left + 105, width: 95 },
      { label: 'NO OF DAYS', x: left + 200, width: 55, align: 'right' },
      { label: 'ADVANCE PAID', x: left + 255, width: 75, align: 'right' },
      { label: 'TOTAL SALARY', x: left + 330, width: 85, align: 'right' },
      { label: 'REMAINING TO PAY', x: left + 415, width: contentWidth - 415, align: 'right' },
    ], workerRows.map(row => ({
      cells: [row.workerName, row.labourType, formatDays(row.days), formatAmount(row.advancePaid), formatAmount(row.totalSalary), formatAmount(row.remaining)],
      bold: [false, false, false, false, true, true],
      color: [null, null, null, null, null, remainingColor(row)],
    })), {
      emptyText: 'No labour entries in this range.',
      total: workerRows.length
        ? ['Total', '', formatDays(sum('days')), formatAmount(sum('advancePaid')), formatAmount(sum('totalSalary')), formatAmount(sum('remaining'))]
        : null,
    });
    const overAdvanced = workerRows.filter(row => row.remaining < 0);
    if (overAdvanced.length) {
      y += 6;
      const warning = `Alert: advance is more than salary for ${overAdvanced.map(row => `${row.workerName} (${formatAmount(row.remaining)})`).join(', ')}`;
      const height = measure(warning, contentWidth - 8, 10, true) + 6;
      ensureSpace(height + 4);
      text(warning, left + 4, y, { size: 10, bold: true, color: COLORS.danger, width: contentWidth - 8, align: 'right' });
      y += height;
    }
    y += 18;

    // ================= Attendance by date =================
    // Date on the first row of each day, then how many of each labour type were present
    section('Attendance by date');
    drawTable([
      { label: 'DATE', x: left, width: 130 },
      { label: 'LABOUR TYPE', x: left + 130, width: contentWidth - 230 },
      { label: 'NO OF DAYS', x: left + contentWidth - 100, width: 100, align: 'right' },
    ], attendance.flatMap(day => day.entries.map((entry, i) => ({
      cells: [i === 0 ? formatDate(day.date) : '', entry.labourType, formatDays(entry.days)],
    }))), { emptyText: 'No labour entries in this range.' });
    y += 18;

    // ================= Credits · Open =================
    section('Credits · Open');
    const openCredits = credits.filter(c => c.status === 'open');
    drawTable([
      { label: 'DATE', x: left, width: 100 },
      { label: 'SHOP / VENDOR', x: left + 100, width: 160 },
      { label: 'AMOUNT', x: left + 260, width: 100, align: 'right' },
      { label: 'REMARKS', x: left + 360, width: contentWidth - 360 },
    ], openCredits.map(c => ({
      cells: [formatDate(c.date), c.shopName, formatAmount(c.amount), c.remarks || ''],
    })), {
      emptyText: 'No open credits on this site.',
      total: openCredits.length ? ['Total', '', formatAmount(openCredits.reduce((s, c) => s + Number(c.amount || 0), 0)), ''] : null,
    });

    // ================= Footer on every page =================
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins = { ...doc.page.margins, bottom: 0 }; // allow drawing inside the bottom margin without spawning a page
      const footerY = doc.page.height - 24;
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
 *         numeric: [columnIndex], footer: [string] | null,
 *         notes: [string | { text, bold, danger, small }] (lines under the table),
 *         siteFirst: site name as the big heading with the title under it (like the site report),
 *         summary: { title, lines: [{ label, value, bold, danger }] } (a summary block under the table) }
 * A row can also be { group: 'text' }: a shaded heading row (e.g. a date), with the rows under it indented.
 */
async function generateTablePDF(data) {
  const letterheadFile = await loadLetterhead(data.letterhead);
  const margins = { top: 50, bottom: 45, left: PAGE_MARGIN - 14, right: PAGE_MARGIN - 14 };
  const TOP = margins.top;
  const BOTTOM_LIMIT = margins.bottom;
  return new Promise((resolve, reject) => {
    const {
      company = 'Balu Hari Builders', siteName = '', title = '', subtitle = '', meta = [],
      headers = [], rows = [], numeric = [], footer = null, letterhead, siteFirst = false, summary = null,
    } = data;
    const isGroup = row => !Array.isArray(row);
    const dataRows = rows.filter(row => !isGroup(row));
    const hasGroups = dataRows.length !== rows.length;
    const INDENT = hasGroups ? 14 : 0;
    const notes = Array.isArray(data.notes) ? data.notes.filter(n => n && (typeof n === 'string' || n.text)) : [];

    // Portrait, to match the letter pad behind every page
    const margin = PAGE_MARGIN - 14;
    const doc = new PDFDocument({
      margins,
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
      info: { Title: `${siteName} - ${title}`, Author: company },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    useLetterheadScaled(doc, letterheadFile);

    const left = margin;
    const contentWidth = doc.page.width - margin * 2;
    const bottomLimit = doc.page.height - BOTTOM_LIMIT;
    let y = TOP;

    const latinFont = bold => (bold ? 'Helvetica-Bold' : 'Helvetica');
    const tamilFont = bold => (bold ? tamilBold : tamilRegular);
    // Helvetica has no rupee glyph
    // Helvetica has no warning-sign glyph either
    const clean = value => String(value ?? '').replace(/₹\s?/g, 'Rs. ').replace(/⚠️?\s?/g, '! ');

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

    // Column widths follow the content, capped so one long column can't squeeze the rest.
    // Each column is kept at least as wide as its (uppercase) header so headers stay on one line,
    // and amount columns as wide as their longest amount (including the Total row).
    const FONT = 9.5;
    const PAD = 8;
    const headerMin = headers.map((h, i) => {
      const headerWidth = measureWidth(h.toUpperCase(), 8.5, true);
      if (!numeric.includes(i)) return headerWidth + PAD + 2;
      const cells = [...dataRows.map(r => r[i]), ...(footer ? [footer[i]] : [])];
      return Math.max(headerWidth, ...cells.map(c => measureWidth(c, FONT, true))) + PAD + 2;
    });
    const natural = headers.map((h, i) => {
      const cells = [...dataRows.map(r => r[i]), ...(footer ? [footer[i]] : [])];
      const widest = Math.max(0, ...cells.map(c => measureWidth(c, FONT, true))) + (i === 0 ? INDENT : 0);
      return Math.max(Math.min(Math.max(widest + PAD, 50), 220), headerMin[i]);
    });
    const total = natural.reduce((a, b) => a + b, 0);
    const minTotal = headerMin.reduce((a, b) => a + b, 0);
    let widths;
    if (total <= contentWidth || minTotal >= contentWidth) {
      widths = natural.map(w => w * (contentWidth / total));
    } else {
      // Too wide: shrink only the room above each header's minimum
      const shrink = (total - contentWidth) / (total - minTotal);
      widths = natural.map((w, i) => w - (w - headerMin[i]) * shrink);
    }
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const align = i => (numeric.includes(i) ? 'right' : 'left');

    const tableHeader = () => {
      const height = Math.max(...headers.map((h, i) => measureHeight(h.toUpperCase(), widths[i] - PAD, 8.5, true))) + 12;
      doc.rect(left, y, contentWidth, height).fill(COLORS.headBg);
      headers.forEach((h, i) => text(h.toUpperCase(), xs[i] + PAD / 2, y + 6, { size: 8.5, bold: true, color: COLORS.accent, width: widths[i] - PAD, align: align(i) }));
      y += height;
    };

    // ---- Heading ----
    if (siteFirst) {
      text(siteName, left, TOP, { size: 16, bold: true, width: contentWidth });
      y = TOP + measureHeight(siteName, contentWidth, 16, true) + 8;
      text(title, left, y, { size: 12.5, bold: true, color: COLORS.accent, width: contentWidth });
      y += measureHeight(title, contentWidth, 12.5, true) + 4;
      hr(y, COLORS.accent, 1.2);
      y += 8;
    } else {
      text(title.toUpperCase(), left, TOP, { size: 13, bold: true, color: COLORS.accent, width: contentWidth, align: 'center' });
      y = TOP + 24;
      text(siteName, left, y, { size: 13, bold: true, width: contentWidth });
      y += 20;
    }
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
    const cellWidth = i => widths[i] - PAD - (i === 0 ? INDENT : 0);
    const rowHeight = row => Math.max(...row.map((c, i) => measureHeight(c, cellWidth(i), FONT))) + 10;
    let stripe = 0;
    rows.forEach((row, rIdx) => {
      if (isGroup(row)) {
        // Shaded heading row (e.g. a date), kept on the same page as its first row
        const height = measureHeight(row.group, contentWidth - PAD, 10.5, true) + 12;
        const next = rows[rIdx + 1];
        const nextHeight = next && !isGroup(next) ? rowHeight(next) : 0;
        if (y + height + nextHeight > bottomLimit) {
          doc.addPage();
          y = TOP;
          tableHeader();
        }
        doc.rect(left, y, contentWidth, height).fill('#f3f6fa');
        text(row.group, left + PAD / 2, y + 6, { size: 10.5, bold: true, color: COLORS.accent, width: contentWidth - PAD });
        y += height;
        return;
      }
      const height = rowHeight(row);
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
        tableHeader();
      }
      if (!hasGroups && stripe % 2 === 1) doc.rect(left, y, contentWidth, height).fill('#f8fafc');
      stripe += 1;
      row.forEach((c, i) => text(c, xs[i] + PAD / 2 + (i === 0 ? INDENT : 0), y + 5, { size: FONT, width: cellWidth(i), align: align(i) }));
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

    // ---- Notes under the table (e.g. contract balance and the advance warning) ----
    if (notes.length) y += 8;
    notes.forEach(note => {
      const line = typeof note === 'string' ? { text: note } : note;
      const size = line.small ? 8.5 : 10;
      const height = measureHeight(line.text, contentWidth, size, line.bold) + 4;
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
      }
      text(line.text, left, y, { size, bold: Boolean(line.bold), color: line.danger ? COLORS.danger : COLORS.accent, width: contentWidth, align: 'right' });
      y += height;
    });

    // ---- Summary block (like the site report's Selected Period Summary) ----
    const summaryLines = summary && Array.isArray(summary.lines) ? summary.lines : [];
    if (summaryLines.length) {
      y += 16;
      if (y + 40 + summaryLines.length * 20 > bottomLimit) {
        doc.addPage();
        y = TOP;
      }
      if (summary.title) {
        text(summary.title, left, y, { size: 12.5, bold: true, color: COLORS.accent, width: contentWidth });
        y += measureHeight(summary.title, contentWidth, 12.5, true) + 4;
        hr(y, COLORS.accent, 1.2);
        y += 8;
      }
      summaryLines.forEach(line => {
        const color = line.danger ? COLORS.danger : COLORS.dark;
        text(line.label, left + 4, y, { size: 11, bold: Boolean(line.bold), color, width: contentWidth * 0.6, lineBreak: false });
        text(line.value, left, y, { size: 11, bold: true, color, width: contentWidth - 4, align: 'right', lineBreak: false });
        y += 20;
        hr(y - 4, '#e5e5e5', 0.5);
      });
    }

    // ---- Footer on every page ----
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins = { ...doc.page.margins, bottom: 0 };
      const footerY = doc.page.height - 24;
      text(`${siteName}  |  ${title}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth * 0.75, lineBreak: false });
      text(`Page ${i + 1} of ${pages.count}`, left, footerY, { size: 8, color: COLORS.muted, width: contentWidth, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateSiteReportPDF, generateTablePDF };


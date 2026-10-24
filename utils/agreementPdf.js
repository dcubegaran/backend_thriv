const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Agreement PDF made on the server (used by the mobile app). It follows the same format as the
// website's agreement pages (client/src/components/agreement/agreementFormat.js):
// - title, then each section printed exactly as typed (line breaks, indentation, own numbering)
// - bold section headings (the 3rd box's heading centred)
// - "-2-" page numbers at the top, the 1st / 2nd party signature labels at the bottom of every page
// - the signatures + "Witnesses : 1. 2." at the bottom of the last page of the 2nd box,
//   after which the 3rd box (payment schedule) starts on a new page.
// No letter pad: agreements are printed on stamp / plain paper.

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const TAMIL_REGULAR = path.join(FONT_DIR, 'noto-serif-tamil-tamil-400.woff');
const TAMIL_BOLD = path.join(FONT_DIR, 'noto-serif-tamil-tamil-700.woff');
const HAS_TAMIL = fs.existsSync(TAMIL_REGULAR) && fs.existsSync(TAMIL_BOLD);
// The Tamil font has Tamil letters and "₹" but no Latin letters or digits: those use Times
const TAMIL_RE = /[஀-௿‌‍₹]/;
const RUN_RE = /[஀-௿‌‍₹]+|[^஀-௿‌‍₹]+/g;

const LABELS = {
  ta: { party1: '1-வது நபர் :', party2: '2-வது நபர் :', witnesses: 'சாட்சிகள் :', rs: 'ரூ.', workHeading: 'கட்டிட வேலை விளக்கம் :', paymentHeading: 'பணம் பெறும் முறைகள்' },
  en: { party1: '1st Party :', party2: '2nd Party :', witnesses: 'Witnesses :', rs: 'Rs.', workHeading: 'Description of Building Work :', paymentHeading: 'Payment Schedule' },
};

// Geometry: the website lays pages out in CSS px (793 x 1122); 1px = 0.75pt here
const PX = 0.75;
const G = {
  padTop: 74 * PX, padX: 76 * PX, footer: 132 * PX,
  size: 16 * PX, lineHeight: 16 * 1.85 * PX,
  endSignBottom: 40 * PX, signBottom: 54 * PX, signSpace: 52 * PX,
};
const CARRY_LINES = 3;

const filled = s => String(s ?? '').trim() !== '';
const defaultHeading = (index, lang) => (index === 1 ? LABELS[lang].workHeading : index === 2 ? LABELS[lang].paymentHeading : '');
const formatAmount = (amount, lang) => (amount === '' || amount === null || amount === undefined ? '' : `${LABELS[lang].rs} ${Number(amount).toLocaleString('en-IN')}/-`);

// Agreements saved with the first (structured) editor are shown as the three free-text boxes
function legacySections(a, lang) {
  const labels = LABELS[lang];
  const clauses = (a.clauses || []).filter(filled);
  const witnesses = (a.witnesses || []).filter(filled);
  const payments = (a.payments || []).filter(p => filled(p.description) || filled(p.amount));
  const part2 = [...clauses.map((c, i) => `${i + 1}.\t${c}`), filled(a.closing) ? a.closing : null,
    witnesses.length ? [labels.witnesses, ...witnesses.map((w, i) => `${i + 1}. ${w}`)].join('\n') : null].filter(Boolean);
  const part3 = payments.map((p, i) => {
    const amount = formatAmount(p.amount, lang);
    return `${i + 1}.\t${p.description || ''}${amount ? `\t..\t${amount}` : ''}`;
  });
  return [
    { heading: '', text: (a.intro || []).filter(filled).join('\n\n'), newPage: false },
    { heading: a.workHeading || '', text: part2.join('\n\n'), newPage: false },
    { heading: a.paymentHeading || '', text: part3.join('\n'), newPage: part3.length > 0 },
  ];
}

// Same blocks as the website builds (title / heading / payHeading / line / gap / endSign / pageBreak)
function buildBlocks(a, lang) {
  const sections = (a.sections || []).some(s => filled(s && s.text)) ? a.sections : legacySections(a, lang);
  const blocks = [];
  if (filled(a.title)) blocks.push({ type: 'title', text: a.title, keepWithNext: true });
  let signed = false;
  sections.forEach((section, index) => {
    if (index === 2 && blocks.length) {
      blocks.push({ type: 'endSign' });
      if (filled(section && section.text)) blocks.push({ type: 'pageBreak' });
      signed = true;
    }
    if (!section || !filled(section.text)) return;
    if (section.newPage && blocks.length) blocks.push({ type: 'pageBreak' });
    else if (blocks.length) blocks.push({ type: 'gap' });
    const heading = section.heading ?? defaultHeading(index, lang);
    if (filled(heading)) blocks.push({ type: index === 2 ? 'payHeading' : 'heading', text: heading, keepWithNext: true });
    const lines = String(section.text).replace(/\r\n?/g, '\n').replace(/\s+$/, '').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    lines.forEach(line => blocks.push(line.trim()
      ? { type: 'line', text: line, keepWithNext: /:\s*$/.test(line) }
      : { type: 'gap' }));
  });
  if (!signed) blocks.push({ type: 'endSign' });
  return blocks;
}

function generateAgreementPDF(agreement) {
  return new Promise((resolve, reject) => {
    const lang = agreement.language === 'en' ? 'en' : 'ta';
    const labels = LABELS[lang];
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true,
      info: { Title: agreement.title || 'Agreement', Author: 'Balu Hari Builders' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const contentW = pageW - G.padX * 2;
    const contentH = pageH - G.padTop - G.footer;

    // ---- text with Tamil / Latin runs ----
    const latin = bold => (bold ? 'Times-Bold' : 'Times-Roman');
    const tamil = bold => (bold ? TAMIL_BOLD : TAMIL_REGULAR);
    const isTamil = run => HAS_TAMIL && TAMIL_RE.test(run);
    const prep = str => String(str ?? '').replace(/\t/g, '      ').replace(/₹/g, HAS_TAMIL ? '₹' : 'Rs. ');
    const runsOf = str => str.match(RUN_RE) || [];
    const setFont = (run, size, bold) => doc.font(isTamil(run) ? tamil(bold) : latin(bold)).fontSize(size);
    const widthOf = (str, size, bold) => runsOf(str).reduce((w, run) => { setFont(run, size, bold); return w + doc.widthOfString(run); }, 0);
    const ascent = (font, size) => { doc.font(font).fontSize(size); return ((doc._font && doc._font.ascender) || 0) / 1000 * size; };

    // Draws one line of runs on a common baseline; `spaceExtra` widens each space (justified lines)
    const drawLine = (str, x, y, size, bold, spaceExtra = 0) => {
      const latinAscent = ascent(latin(bold), size);
      let cx = x;
      runsOf(str).forEach(run => {
        const offset = isTamil(run) ? latinAscent - ascent(tamil(bold), size) : 0;
        // split into words and spaces so justified lines can stretch the spaces
        (spaceExtra ? run.split(/( +)/) : [run]).forEach(piece => {
          if (!piece) return;
          setFont(run, size, bold);
          // only single spaces between words stretch; runs of spaces (tabs, alignment) keep their width
          if (spaceExtra && /^ +$/.test(piece)) { cx += doc.widthOfString(piece) + (piece.length === 1 ? spaceExtra : 0); return; }
          doc.text(piece, cx, y + offset, { lineBreak: false });
          cx += doc.widthOfString(piece);
        });
      });
      return cx - x;
    };

    // Wraps a paragraph to the width, keeping its leading indentation. Returns [{ text, last }]
    const wrap = (raw, maxW, size, bold) => {
      const str = prep(raw);
      const indent = (str.match(/^ */) || [''])[0];
      const tokens = str.slice(indent.length).split(/( +)/).filter(Boolean);
      const lines = [];
      let line = indent;
      let lineW = widthOf(indent, size, bold);
      tokens.forEach(tok => {
        const space = /^ +$/.test(tok);
        const w = widthOf(tok, size, bold);
        if (!space && line.trim() && lineW + w > maxW) {
          lines.push(line.replace(/ +$/, ''));
          line = '';
          lineW = 0;
        }
        if (space && !line) return;
        // a single word wider than the line is split by characters
        if (!space && w > maxW) {
          [...tok].forEach(ch => {
            const cw = widthOf(ch, size, bold);
            if (lineW + cw > maxW && line) { lines.push(line); line = ''; lineW = 0; }
            line += ch; lineW += cw;
          });
          return;
        }
        line += tok;
        lineW += w;
      });
      lines.push(line.replace(/ +$/, ''));
      return lines.map((text, i) => ({ text, last: i === lines.length - 1 }));
    };

    // ---- block sizes and drawing ----
    const spec = type => ({
      title: { size: 19 * PX, bold: true, align: 'center', padBottom: 24 * PX },
      heading: { size: G.size, bold: true, align: 'left', padTop: 6 * PX, padBottom: 14 * PX },
      payHeading: { size: 17 * PX, bold: true, align: 'center', padBottom: 20 * PX },
      line: { size: G.size, bold: false, align: 'justify', padBottom: 6 * PX },
    }[type]);

    const blocks = buildBlocks(agreement, lang);
    const witnessH = 34 * PX + G.lineHeight + 2 * (30 * PX + G.lineHeight);
    const endSignH = 6 * PX + G.signSpace + G.lineHeight + witnessH;
    const layoutOf = block => {
      if (block.type === 'gap') return { height: 14 * PX };
      if (block.type === 'endSign') return { height: endSignH };
      if (block.type === 'pageBreak') return { height: 0 };
      const s = spec(block.type);
      const lh = s.size * 1.85;
      const lines = wrap(block.text, contentW, s.size, s.bold);
      return { lines, lineHeight: lh, height: (s.padTop || 0) + lines.length * lh + (s.padBottom || 0) };
    };
    const layouts = blocks.map(layoutOf);
    const heights = layouts.map(l => l.height);

    // ---- pagination (same rules as the website) ----
    const pages = [[]];
    let used = 0;
    blocks.forEach((block, i) => {
      if (block.type === 'pageBreak') { if (pages[pages.length - 1].length) { pages.push([]); used = 0; } return; }
      if (block.type === 'gap' && used === 0) return;
      if (block.type === 'endSign') {
        const room = pageH - G.padTop - G.endSignBottom - 7.5;
        if (used > 0 && used + heights[i] > room) {
          const current = pages[pages.length - 1];
          const carried = [];
          let lines = 0;
          while (current.length > 1 && lines < CARRY_LINES) {
            const idx = current.pop();
            carried.unshift(idx);
            if (blocks[idx].type !== 'gap') lines += 1;
          }
          while (current.length > 1 && blocks[current[current.length - 1]].keepWithNext) carried.unshift(current.pop());
          while (carried.length && blocks[carried[0]].type === 'gap') carried.shift();
          pages.push(carried);
          used = carried.reduce((sum, idx) => sum + heights[idx], 0);
        }
        pages[pages.length - 1].push(i);
        used += heights[i];
        return;
      }
      let need = heights[i];
      if (block.keepWithNext) {
        let j = i + 1;
        while (j < blocks.length && blocks[j].type === 'gap') need += heights[j++];
        if (j < blocks.length && blocks[j].type !== 'pageBreak') need += heights[j];
      }
      if (used > 0 && used + need > contentH) {
        if (block.type === 'gap') return;
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(i);
      used += heights[i];
    });

    // ---- drawing ----
    const signRow = y => {
      drawLine(prep(labels.party1), G.padX, y, G.size, true);
      drawLine(prep(labels.party2), G.padX + contentW * 0.58, y, G.size, true);
    };
    const drawText = (layout, s, y) => {
      let cy = y + (s.padTop || 0);
      layout.lines.forEach(({ text, last }) => {
        const w = widthOf(text, s.size, s.bold);
        let x = G.padX;
        let extra = 0;
        if (s.align === 'center') x = G.padX + (contentW - w) / 2;
        else if (s.align === 'justify' && !last) {
          const spaces = (text.replace(/^ +/, '').match(/(?<! ) (?! )/g) || []).length; // single spaces only
          if (spaces > 0) extra = Math.max(0, (contentW - w) / spaces);
        }
        if (extra) {
          // keep the leading indentation as is, stretch only the spaces between words
          const indent = (text.match(/^ */) || [''])[0];
          const indentW = widthOf(indent, s.size, s.bold);
          drawLine(text.slice(indent.length), x + indentW, cy, s.size, s.bold, extra);
        } else {
          const drawnW = drawLine(text, x, cy, s.size, s.bold);
          if (s.underline) doc.moveTo(x, cy + s.size + 1).lineTo(x + drawnW, cy + s.size + 1).lineWidth(0.8).strokeColor('#111').stroke();
        }
        cy += layout.lineHeight;
      });
    };

    pages.forEach((indexes, p) => {
      if (p > 0) doc.addPage();
      doc.fillColor('#111');
      if (p > 0) {
        const label = `-${p + 1}-`;
        doc.font('Times-Roman').fontSize(14 * PX);
        doc.text(label, (pageW - doc.widthOfString(label)) / 2, 30 * PX, { lineBreak: false });
      }
      let y = G.padTop;
      let hasEndSign = false;
      indexes.forEach(i => {
        const block = blocks[i];
        if (block.type === 'endSign') { hasEndSign = true; return; }
        if (block.type !== 'gap') {
          const s = { ...spec(block.type), underline: block.type === 'title' };
          drawText(layouts[i], s, y);
        }
        y += heights[i];
      });
      if (hasEndSign) {
        // signatures + witnesses at the bottom of the page
        let ey = pageH - G.endSignBottom - endSignH + 6 * PX + G.signSpace;
        signRow(ey);
        ey += G.lineHeight + 34 * PX;
        drawLine(prep(labels.witnesses), G.padX, ey, G.size, false);
        ['1.', '2.'].forEach(n => { ey += G.lineHeight + 30 * PX; drawLine(n, G.padX, ey, G.size, false); });
      } else {
        signRow(pageH - G.signBottom - G.lineHeight);
      }
    });

    doc.end();
  });
}

module.exports = { generateAgreementPDF };

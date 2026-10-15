// Builds a monthly or yearly review as an A4 PDF (with jsPDF) and hands it to the device
// to save or share. The PDF library loads on first use and is then cached for offline use.

const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const SAGE = [95, 113, 80], INK = [31, 37, 32], MUTED = [103, 112, 95], LINE = [205, 211, 196], PAPER = [245, 246, 241], OCHRE = [176, 122, 38];
export const WEEK_RGB = [[205, 220, 236], [238, 221, 196], [212, 229, 203], [229, 211, 230], [240, 226, 182], [200, 228, 226]];

function loadLib() {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the PDF tool. Check your internet connection and try again.'));
    document.head.appendChild(s);
  });
}

// PDF fonts can't draw emoji, so they are removed from names.
const clean = s => String(s ?? '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/\s+/g, ' ').trim();
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const level = p => p == null ? null : mix([255, 255, 255], SAGE, p === 0 ? 0.08 : 0.25 + 0.75 * p);

export async function reviewPdf(r) {
  await loadLib();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 16, W = PW - 2 * M;
  let y = 20;

  const color = (c, kind = 'text') => kind === 'fill' ? doc.setFillColor(...c) : kind === 'draw' ? doc.setDrawColor(...c) : doc.setTextColor(...c);
  const font = (size, style = 'normal', c = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); color(c); };
  const ensure = h => { if (y + h > PH - 18) { doc.addPage(); y = 20; } };
  const section = title => { ensure(16); y += 4; font(12, 'bold'); doc.text(clean(title), M, y); y += 6; };
  const box = (x, yy, w, h) => { color(PAPER, 'fill'); color(LINE, 'draw'); doc.setLineWidth(0.25); doc.roundedRect(x, yy, w, h, 2.5, 2.5, 'FD'); };

  // Title
  font(9, 'normal', MUTED); doc.text(clean(r.kicker), M, y); y += 7;
  font(22, 'bold'); doc.text(clean(r.title), M, y); y += 9;

  // Key figures
  const n = r.stats.length, gap = 4, bw = (W - gap * (n - 1)) / n;
  r.stats.forEach(([label, value], i) => {
    const x = M + i * (bw + gap);
    box(x, y, bw, 19);
    font(16, 'bold'); doc.text(clean(value), x + 4, y + 9);
    font(8, 'normal', MUTED); doc.text(doc.splitTextToSize(clean(label), bw - 8)[0], x + 4, y + 15);
  });
  y += 25;

  // Highlights
  if (r.highlights.length) {
    const hn = r.highlights.length, hw = (W - gap * (hn - 1)) / hn;
    r.highlights.forEach(([label, value, fig], i) => {
      const x = M + i * (hw + gap);
      box(x, y, hw, 24);
      font(8, 'normal', MUTED); doc.text(clean(label), x + 4, y + 6);
      font(10, 'bold'); doc.text(doc.splitTextToSize(clean(value), hw - 8)[0], x + 4, y + 12);
      font(15, 'bold', SAGE); doc.text(clean(fig), x + 4, y + 20);
    });
    y += 30;
  }

  // Weeks (monthly review)
  if (r.weeks?.length) {
    section(r.labels.weeks);
    r.weeks.forEach(w => {
      ensure(8);
      color(WEEK_RGB[w.color], 'fill'); doc.roundedRect(M, y - 4, 22, 6, 1.5, 1.5, 'F');
      font(9, 'bold'); doc.text(clean(w.label), M + 3, y);
      font(8, 'normal', MUTED); doc.text(clean(w.range), M + 26, y);
      const bx = M + 60, bwid = W - 60 - 16;
      color(mix(PAPER, LINE, 0.6), 'fill'); doc.roundedRect(bx, y - 3, bwid, 3.5, 1.5, 1.5, 'F');
      if (w.pct != null && w.pct > 0) { color(SAGE, 'fill'); doc.roundedRect(bx, y - 3, Math.max(2, bwid * w.pct), 3.5, 1.5, 1.5, 'F'); }
      font(9, 'bold'); doc.text(w.pct == null ? '–' : `${Math.round(w.pct * 100)}%`, PW - M, y, { align: 'right' });
      y += 8;
    });
  }

  // Calendar
  if (r.heat) {
    section(r.labels.calendar);
    if (r.heat.type === 'month') {
      const cs = 11, cg = 2;
      font(8, 'bold', MUTED);
      r.heat.weekdays.forEach((d, i) => doc.text(clean(d), M + 22 + i * (cs + cg) + cs / 2, y, { align: 'center' }));
      y += 3;
      r.heat.rows.forEach(row => {
        ensure(cs + cg + 2);
        color(WEEK_RGB[row.color], 'fill'); doc.roundedRect(M, y - 0.5, 22 + 7 * (cs + cg), cs + 1, 2, 2, 'F');
        font(8, 'bold'); doc.text(clean(row.label), M + 3, y + cs / 2 + 1.5);
        row.cells.forEach((c, i) => {
          if (!c) return;
          const x = M + 22 + i * (cs + cg);
          const f = c.future ? [255, 255, 255] : level(c.pct) || [255, 255, 255];
          color(f, 'fill'); color(LINE, 'draw'); doc.setLineWidth(0.2);
          doc.roundedRect(x, y, cs, cs, 1.8, 1.8, c.future || c.pct == null ? 'FD' : 'F');
          font(7, 'normal', c.pct != null && c.pct > 0.55 && !c.future ? [255, 255, 255] : MUTED);
          doc.text(String(c.day), x + 1.5, y + 3.5);
        });
        y += cs + cg;
      });
      y += 2;
    } else {
      const cs = 4.1, cg = 0.75;
      r.heat.rows.forEach(row => {
        ensure(cs + cg + 1);
        font(7.5, 'normal', MUTED); doc.text(clean(row.label), M, y + cs - 0.6);
        row.cells.forEach((c, i) => {
          if (!c) return;
          const x = M + 13 + i * (cs + cg);
          const f = c.future ? [255, 255, 255] : level(c.pct) || [255, 255, 255];
          color(f, 'fill'); color(LINE, 'draw'); doc.setLineWidth(0.15);
          doc.roundedRect(x, y, cs, cs, 0.8, 0.8, c.future || c.pct == null ? 'FD' : 'F');
        });
        font(7.5, 'bold'); doc.text(row.end || '', PW - M, y + cs - 0.6, { align: 'right' });
        y += cs + cg;
      });
      y += 3;
    }
    // legend
    font(7.5, 'normal', MUTED); doc.text(clean(r.labels.none), M, y + 2.6);
    let lx = M + doc.getTextWidth(clean(r.labels.none)) + 2;
    [0, 0.33, 0.66, 1].forEach(p => { color(level(p), 'fill'); doc.roundedRect(lx, y, 3.5, 3.5, 0.7, 0.7, 'F'); lx += 4.5; });
    doc.text(clean(r.labels.all), lx + 1, y + 2.6);
    y += 8;
  }

  // Habits
  if (r.habits.length) {
    section(r.labels.habits);
    r.habits.forEach(h => {
      ensure(12);
      font(10, 'normal'); doc.text(doc.splitTextToSize(clean(h.name), W - 20)[0], M, y);
      font(10, 'bold'); doc.text(h.pct == null ? '–' : `${Math.round(h.pct * 100)}%`, PW - M, y, { align: 'right' });
      color(mix(PAPER, LINE, 0.6), 'fill'); doc.roundedRect(M, y + 1.6, W, 2.2, 1, 1, 'F');
      if (h.pct) { color(SAGE, 'fill'); doc.roundedRect(M, y + 1.6, Math.max(1.5, W * h.pct), 2.2, 1, 1, 'F'); }
      font(8, 'normal', MUTED); doc.text(clean(h.detail), M, y + 7.6);
      y += 12;
    });
  }

  // Key/value lists (weekly habits, training & tasks)
  (r.lists || []).forEach(list => {
    if (!list.items.length) return;
    section(list.title);
    list.items.forEach(([k, v, c]) => {
      ensure(7);
      if (c != null) { color(WEEK_RGB[c], 'fill'); doc.roundedRect(M, y - 3.6, 3, 4.5, 0.8, 0.8, 'F'); }
      font(10, 'normal'); doc.text(doc.splitTextToSize(clean(k), W - 40)[0], M + (c != null ? 5 : 0), y);
      font(10, 'bold'); doc.text(clean(v), PW - M, y, { align: 'right' });
      color(LINE, 'draw'); doc.setLineWidth(0.15); doc.line(M, y + 2.2, PW - M, y + 2.2);
      y += 7;
    });
  });

  // Goals
  if (r.goals?.length) {
    section(r.labels.goals);
    r.goals.forEach(g => {
      ensure(7);
      color(g.done ? SAGE : [255, 255, 255], 'fill'); color(g.done ? SAGE : MUTED, 'draw'); doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 3.4, 4, 4, 0.8, 0.8, 'FD');
      if (g.done) { color([255, 255, 255], 'draw'); doc.setLineWidth(0.5); doc.line(M + 0.9, y - 1.5, M + 1.8, y - 0.5); doc.line(M + 1.8, y - 0.5, M + 3.2, y - 2.6); }
      font(10, 'normal', g.done ? MUTED : INK); doc.text(doc.splitTextToSize(clean(g.title), W - 8)[0], M + 7, y);
      y += 7;
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font(7.5, 'normal', MUTED);
    doc.text(clean(r.footer), M, PH - 10);
    doc.text(`${p} / ${pages}`, PW - M, PH - 10, { align: 'right' });
    color(OCHRE, 'fill'); doc.rect(M, PH - 14, 12, 0.6, 'F');
  }

  const blob = doc.output('blob');
  const file = new File([blob], r.filename, { type: 'application/pdf' });
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: clean(r.title) }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = r.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}

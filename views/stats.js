// views/stats.js
import { tr, LOC } from '../i18n.js';
import { allHabits, habitName, $, S, addDays, areaInfo, cwLabel, dayIdx, dayStats, daysInMonth, delta, esc, fmtShort, get, habitPeriod, habits, isDone, isWeekly, list, meter, mondayOf, monthKey, monthStats, monthWeeks, pad, parse, pct, save, scheduledOn, streak, today, weekCls, weekNum, ymd } from '../core.js';
import { weekdayIdx } from './train.js';
import * as jc from '../crypto.js';
import { journalEnabled, journalSettings, hasEntry, entryFor, MOODS } from './journal.js';

export function insightData() {
  const t = today(), hs = habits();
  const wd = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
  for (let i = 1; i <= 90; i++) {
    const d = ymd(addDays(parse(t), -i)), s = dayStats(d, hs);
    if (s.total) { wd[dayIdx(d)].v += s.done; wd[dayIdx(d)].n += s.total; }
  }
  const samples = wd.reduce((s, x) => s + x.n, 0);
  const pcts = wd.map(x => (x.n ? x.v / x.n : null));
  const items = [];
  if (samples < 14) return { pcts, items, enough: false };
  const ranked = pcts.map((p, i) => ({ p, i })).filter(x => x.p != null).sort((x, y) => y.p - x.p);
  const dayName = i => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'long' });
  if (ranked.length >= 2 && ranked[0].p - ranked[ranked.length - 1].p >= 0.1) {
    items.push({ ic: '📈', title: tr('{day} is your best day', { day: dayName(ranked[0].i) }),
      text: tr('{p} of habits done, {day} is the weakest ({q}).', { p: pct(ranked[0].p), day: dayName(ranked[ranked.length - 1].i), q: pct(ranked[ranked.length - 1].p) }) });
  }
  // a habit that clearly works best on one weekday
  let bestHabit = null;
  hs.filter(h => !isWeekly(h)).forEach(h => {
    const per = Array.from({ length: 7 }, () => ({ d: 0, n: 0 }));
    let all = 0, n = 0;
    for (let i = 1; i <= 90; i++) {
      const d = ymd(addDays(parse(t), -i));
      if (!scheduledOn(h, d)) continue;
      const k = dayIdx(d), v = isDone(h.id, d) ? 1 : 0;
      per[k].n++; per[k].d += v; all += v; n++;
    }
    if (n < 20) return;
    per.forEach((x, k) => {
      if (x.n < 4) return;
      const r = x.d / x.n, lift = r - all / n;
      if (r >= 0.8 && lift >= 0.15 && (!bestHabit || lift > bestHabit.lift)) bestHabit = { h, k, x, lift };
    });
  });
  if (bestHabit) items.push({ ic: '⭐', title: tr('"{name}" works best on {day}s', { name: bestHabit.h.data.name, day: dayName(bestHabit.k) }),
    text: tr('Done on {a} of {b} {day}s in the last 3 months.', { a: bestHabit.x.d, b: bestHabit.x.n, day: dayName(bestHabit.k) }) });
  // this month vs last month
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const daysOf = (yy, mm) => [...Array(daysInMonth(yy, mm))].map((_, i) => `${yy}-${pad(mm + 1)}-${pad(i + 1)}`);
  const pm = new Date(y, m - 1, 1);
  let slip = null, rise = null;
  hs.forEach(h => {
    const c = habitPeriod(h, daysOf(y, m)), p = habitPeriod(h, daysOf(pm.getFullYear(), pm.getMonth()));
    if (c.total < 5 || p.total < 7) return;
    const diff = c.done / c.total - p.done / p.total;
    if (diff <= -0.12 && (!slip || diff < slip.diff)) slip = { h, diff, c: c.done / c.total, p: p.done / p.total };
    if (diff >= 0.12 && (!rise || diff > rise.diff)) rise = { h, diff, c: c.done / c.total, p: p.done / p.total };
  });
  if (slip) items.push({ ic: '🧭', title: tr('"{name}" slipped', { name: slip.h.data.name }),
    text: tr('{c} this month, down from {p}.', { c: pct(slip.c), p: pct(slip.p) }) + (slip.h.data.mini ? '' : ' ' + tr('A mini version for busy days might help.')) });
  if (rise) items.push({ ic: '🚀', title: tr('"{name}" is improving', { name: rise.h.data.name }),
    text: tr('{c} this month, up from {p}.', { c: pct(rise.c), p: pct(rise.p) }) });
  return { pcts, items: items.slice(0, 3), enough: true };
}
export function insightsPanel() {
  const ins = insightData();
  const names = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'short' }));
  const max = Math.max(...ins.pcts.filter(p => p != null), 0.01), bestIdx = ins.pcts.indexOf(Math.max(...ins.pcts.filter(p => p != null)));
  return `<section class="panel span-2"><h2>${tr('Insights')}</h2>
    ${ins.enough ? `<div class="wkbars" aria-label="${tr('Habits done by weekday, last 3 months')}">${ins.pcts.map((p, i) => `<div class="${i === bestIdx ? 'best' : ''}"><i style="height:${p == null ? 2 : Math.max(4, Math.round(p / max * 100))}%" title="${p == null ? '' : pct(p)}"></i><small>${names[i]}</small></div>`).join('')}</div>
      ${ins.items.length ? `<div class="insights">${ins.items.map(x => `<div class="insight"><span class="ic" aria-hidden="true">${x.ic}</span><div><b>${esc(x.title)}</b><small>${esc(x.text)}</small></div></div>`).join('')}</div>` : `<p class="note">${tr('No clear patterns yet. Keep going.')}</p>`}`
    : `<p class="note">${tr('Insights appear after about two weeks of check-ins.')}</p>`}
  </section>`;
}

/* ---------- monthly review ---------- */
export function monthReview(y, m) {
  const ms = monthStats(y, m), t = today(), hs = allHabits();
  const past = ms.days.filter(x => !x.future);
  const per = hs.map(h => ({ h, ...habitPeriod(h, ms.days.map(x => x.d)) })).filter(p => p.total);
  const weeks = monthWeeks(y, m).map(w => {
    const ds = ms.days.filter(x => w.days.includes(x.d) && !x.future);
    let d = 0, tt = 0;
    ds.forEach(x => { d += x.done; tt += x.total; });
    return { ...w, pct: tt ? d / tt : null };
  });
  const prefix = `${y}-${pad(m + 1)}`;
  let workouts = 0, kg = 0, exDone = 0;
  for (const x of ms.days) {
    const own = get(`workout_${x.d}`)?.data;
    if (!own) continue;
    const ex = own.exercises || [], ca = own.cardio || [];
    if (ex.some(e => e.done) || ca.some(e => e.done)) workouts++;
    ex.forEach(e => { if (e.done) { exDone++; kg += (+e.weight || 0) * (+e.sets || 0) * (+e.reps || 0); } });
  }
  const tasksDone = list('task').filter(x => x.data.done && (x.data.doneAt || x.updated_at || '').startsWith(prefix)).length;
  const goals = list('goal').filter(g => g.data.month === prefix).sort((a2, b2) => (a2.data.order ?? 0) - (b2.data.order ?? 0));
  const weekly = list('weekly_habit').sort((a2, b2) => (a2.data.order ?? 0) - (b2.data.order ?? 0))
    .map(r => ({ name: r.data.name, n: weeks.filter(w => r.data.weeks?.[w.key]).length, of: weeks.length }));
  const pmd = new Date(y, m - 1, 1), prev = monthStats(pmd.getFullYear(), pmd.getMonth());
  return { ms, per, weeks, workouts, kg, exDone, tasksDone, goals, weekly, prev, prevName: pmd.toLocaleDateString(LOC(), { month: 'long' }) };
}
export const monthTitle = (y, m) => new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });

// Mood comparison, calculated only on this device from decrypted entries while the journal is unlocked.
function moodPanel(y, m) {
  if (!journalEnabled() || !journalSettings()) return '';
  if (!jc.isUnlocked()) return `<section class="panel"><h2>${tr('Mood')}</h2><p class="note">${tr('Unlock your journal to see how your mood relates to training and habits. This is calculated only on your device.')}</p><div class="row"><button class="btn" data-action="open-journal">${tr('Open journal')}</button></div></section>`;
  const days = [];
  for (let i = 1; i <= daysInMonth(y, m); i++) {
    const d = `${y}-${pad(m + 1)}-${pad(i)}`, e = entryFor(d);
    if (!e?.mood) continue;
    const w = get(`workout_${d}`)?.data, trained = !!w && [...(w.exercises || []), ...(w.cardio || [])].some(x => x.done || x.setsDone);
    days.push({ mood: e.mood, trained, perfect: dayStats(d).all });
  }
  const avg = a => a.length ? a.reduce((s2, x) => s2 + x.mood, 0) / a.length : null;
  const pair = (key, a, b) => { const yes = days.filter(x => x[key]), no = days.filter(x => !x[key]); return yes.length >= 3 && no.length >= 3 ? { a: avg(yes), b: avg(no), na: yes.length, nb: no.length, la: a, lb: b } : null; };
  const rows = [pair('trained', 'Days with training', 'Days without training'), pair('perfect', 'Perfect habit days', 'Other days')].filter(Boolean);
  const face = v => MOODS[Math.max(0, Math.min(4, Math.round(v) - 1))];
  return `<section class="panel mood-panel"><h2>${tr('Mood')}</h2>
    ${rows.length ? rows.map(r => `<div class="mood-cmp">
      <div><span class="muted">${tr(r.la)}</span><span class="figure">${face(r.a)} ${r.a.toFixed(1)}</span><small class="muted">${tr('{n} days', { n: r.na })}</small></div>
      <div><span class="muted">${tr(r.lb)}</span><span class="figure">${face(r.b)} ${r.b.toFixed(1)}</span><small class="muted">${tr('{n} days', { n: r.nb })}</small></div></div>`).join('')
      + `<p class="note">${tr('Average mood from 1 to 5. A difference shows a pattern, not a cause.')}</p>`
    : `<p class="note">${tr('Not enough journal entries with a mood yet. Once you have at least 3 days in each group, a comparison appears here.')}</p>`}
  </section>`;
}

export function viewMonth() {
  const [y, mm] = S.reviewMonth.split('-').map(Number), m = mm - 1;
  const r = monthReview(y, m);
  const best = [...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total)[0];
  const bestWeek = r.weeks.filter(w => w.pct != null).sort((a2, b2) => b2.pct - a2.pct)[0];
  const longest = [...r.per].sort((a2, b2) => b2.best - a2.best)[0];
  const highlights = [
    best ? [tr('Most consistent'), esc(best.h.data.name), pct(best.done / best.total)] : null,
    bestWeek ? [tr('Best week'), cwLabel(bestWeek.key), pct(bestWeek.pct)] : null,
    longest && longest.best ? [tr('Longest streak'), esc(longest.h.data.name), tr('{n} days', { n: longest.best })] : null,
  ].filter(Boolean);
  const lvl = p => p == null ? 'l0' : p === 0 ? 'l0 miss' : p < 0.34 ? 'l1' : p < 0.67 ? 'l2' : p < 1 ? 'l3' : 'l4';
  const wdNames = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'short' }));
  const cal = r.weeks.map(w => {
    const first = weekdayIdx(w.days[0]);
    const cells = [...Array(7)].map((_, i) => {
      const d = w.days[i - first];
      if (!d || i < first) return '<td></td>';
      const x = r.ms.days.find(z => z.d === d);
      const je = journalEnabled() && hasEntry(d);
      const inner = `${parse(d).getDate()}${je ? '<i class="j-mark" aria-hidden="true"></i>' : ''}`;
      return `<td>${je ? `<button class="mc ${x.future ? 'fut' : lvl(x.total ? x.pct : null)}" data-action="open-journal" data-d="${d}" title="${tr('Open journal entry')}">${inner}</button>` : `<span class="mc ${x.future ? 'fut' : lvl(x.total ? x.pct : null)}" title="${x.future ? '' : pct(x.pct)}">${inner}</span>`}</td>`;
    }).join('');
    return `<tr class="${weekCls(w.key)}"><th scope="row">${cwLabel(w.key)}</th>${cells}</tr>`;
  }).join('');
  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="review-month" data-dir="-1" aria-label="${tr('Previous month')}">‹</button>
    <div class="head-stack"><p class="sub">${tr('Monthly review')}</p><h1>${monthTitle(y, m)}</h1></div>
    <button class="icon-btn" data-action="review-month" data-dir="1" aria-label="${tr('Next month')}">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${pct(r.ms.pct)}</span><span class="muted">${tr('habits completed')}</span>${r.prev.total && r.ms.total ? delta(r.ms.pct, r.prev.pct, r.prevName) : ''}</div>
    <div><span class="figure">${r.ms.perfect}</span><span class="muted">${tr('perfect days')}</span>${r.prev.total && r.ms.total ? delta(r.ms.perfect, r.prev.perfect, '', false) : ''}</div>
    <div><span class="figure">${r.ms.checkins}</span><span class="muted">${tr('check-ins')}</span></div>
    <div><span class="figure">${r.workouts}</span><span class="muted">${tr('workouts')}</span></div>
    <span class="summary-actions"><button class="btn primary" data-action="pdf" data-kind="month" data-p="${S.reviewMonth}">${tr('Save as PDF')}</button></span>
  </div>
  ${highlights.length ? `<div class="highlights">${highlights.map(([k, v, n]) => `<div class="panel hl"><span class="muted">${k}</span><span class="hl-v">${v}</span><span class="figure">${n}</span></div>`).join('')}</div>` : ''}
  <div class="two-col first">
    <section class="panel">
      <h2>${tr('Weeks')}</h2>
      <ul class="week-bars">${r.weeks.map(w => `<li><span class="wk-chip ${weekCls(w.key)}">${cwLabel(w.key)}</span><span class="muted">${parse(w.days[0]).getDate()}.–${parse(w.days[w.days.length - 1]).getDate()}.</span>${meter(w.pct || 0, cwLabel(w.key))}<span class="num">${w.pct == null ? '–' : pct(w.pct)}</span></li>`).join('')}</ul>
    </section>
    <section class="panel">
      <h2>${tr('Every day of the month')}</h2>
      <div class="grid-scroll"><table class="month-cal"><thead><tr><th></th>${wdNames.map(n => `<th scope="col">${n}</th>`).join('')}</tr></thead><tbody>${cal}</tbody></table></div>
    </section>
    ${moodPanel(y, m)}
    <section class="panel">
      <h2>${tr('Habits this month')}</h2>
      ${r.per.length ? `<ul class="year-habits">${[...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => `<li>
        <span class="label">${esc(areaInfo(p.h.data.area).icon)} ${esc(habitName(p.h))}</span><span class="num">${pct(p.done / p.total)}</span>
        ${meter(p.done / p.total, habitName(p.h))}
        <span class="muted">${habitDetail(p)}</span></li>`).join('')}</ul>` : `<p class="note">${tr('No habit data for this month yet.')}</p>`}
    </section>
    <section class="panel">
      <h2>${tr('Training and tasks')}</h2>
      <dl class="stats">
        <div><dt>${tr('Workouts')}</dt><dd>${r.workouts}</dd></div>
        <div><dt>${tr('Exercises done')}</dt><dd>${r.exDone}</dd></div>
        <div><dt>${tr('kg moved')}</dt><dd>${Math.round(r.kg).toLocaleString(LOC())}</dd></div>
        <div><dt>${tr('Tasks completed')}</dt><dd>${r.tasksDone}</dd></div>
      </dl>
      ${r.weekly.length ? `<h3 class="day-label">${tr('Weekly habits')}</h3><dl class="stats">${r.weekly.map(w => `<div><dt>${esc(w.name)}</dt><dd>${w.n}<small>/${w.of}</small></dd></div>`).join('')}</dl>` : ''}
      ${r.goals.length ? `<h3 class="day-label">${tr('Goals')}</h3><ul class="goal-list">${r.goals.map(g => `<li class="${g.data.done ? 'is-done' : ''}"><span class="box" aria-hidden="true"></span>${esc(g.data.title)}</li>`).join('')}</ul>` : ''}
    </section>
    ${S.reviewMonth === monthKey(new Date()) && habits().length ? insightsPanel() : ''}
  </div>`;
}

export const habitDetail = p => p.weeks ? tr('{n} of {of} weeks reached · {c} check-ins', { n: p.done, of: p.total, c: p.checkins })
  : tr('{n} check-ins · best streak {b} days', { n: p.checkins, b: p.best });

/* ---------- reviews list + PDF ---------- */
export function reviewPeriods() {
  const now = monthKey(new Date());
  let first = now;
  const bump = d => { if (d && /^\d{4}-\d{2}/.test(d) && d.slice(0, 7) < first) first = d.slice(0, 7); };
  list('habit_log').forEach(r => r.data.done && bump(r.data.date));
  list('workout').forEach(r => bump(r.data.date));
  list('goal').forEach(r => bump(r.data.month));
  list('task').forEach(r => r.data.done && bump(r.data.doneAt));
  const months = [];
  let [yy, mm] = first.split('-').map(Number);
  while (`${yy}-${pad(mm)}` <= now) { months.push(`${yy}-${pad(mm)}`); mm++; if (mm > 12) { mm = 1; yy++; } }
  const years = [...new Set(months.map(k => +k.slice(0, 4)))].sort((p, q) => q - p);
  return years.map(Y => ({ year: Y, months: months.filter(k => k.startsWith(`${Y}-`)).reverse() }));
}
export function viewReviews() {
  return `<header class="page-head"><h1>${tr('All reviews')}</h1></header>${reviewsSection()}`;
}
export function reviewsSection() {
  const groups = reviewPeriods();
  return `<section class="panel"><h2>${tr('Reviews')}</h2>
    <p class="note">${tr('Look back at any month or year, or save it as a PDF.')}</p>
    ${groups.map(g => `<h3 class="day-label">${g.year}</h3>
      <ul class="review-list">
        <li class="yr"><button data-action="open-year" data-y="${g.year}">${tr('Year review {y}', { y: g.year })}</button><button class="btn small" data-action="pdf" data-kind="year" data-p="${g.year}">PDF</button></li>
        ${g.months.map(k => { const [Y, M] = k.split('-').map(Number); return `<li><button data-action="open-month" data-m="${k}">${new Date(Y, M - 1, 1).toLocaleDateString(LOC(), { month: 'long' })}</button><button class="btn small" data-action="pdf" data-kind="month" data-p="${k}">PDF</button></li>`; }).join('')}
      </ul>`).join('')}
  </section>`;
}
export const pdfLabels = () => ({ weeks: tr('Weeks'), calendar: tr('Every day'), habits: tr('Habits'), goals: tr('Goals'), none: tr('none'), all: tr('all habits') });
export const pdfFooter = () => `${tr('Habit & Life Tracker')} · ${tr('created {date}', { date: new Date().toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric' }) })}`;
export function monthPdfData(key) {
  const [y, mm] = key.split('-').map(Number), m = mm - 1, r = monthReview(y, m);
  const best = [...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total)[0];
  const bestWeek = r.weeks.filter(w => w.pct != null).sort((a2, b2) => b2.pct - a2.pct)[0];
  const longest = [...r.per].sort((a2, b2) => b2.best - a2.best)[0];
  const wdNames = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'short' }));
  return {
    kicker: tr('Monthly review'), title: monthTitle(y, m), filename: `${tr('Review')}-${key}.pdf`, footer: pdfFooter(), labels: pdfLabels(),
    stats: [[tr('habits completed'), pct(r.ms.pct)], [tr('perfect days'), String(r.ms.perfect)], [tr('check-ins'), String(r.ms.checkins)], [tr('workouts'), String(r.workouts)]],
    highlights: [best && [tr('Most consistent'), best.h.data.name, pct(best.done / best.total)], bestWeek && [tr('Best week'), cwLabel(bestWeek.key), pct(bestWeek.pct)],
      longest && longest.best && [tr('Longest streak'), longest.h.data.name, tr('{n} days', { n: longest.best })]].filter(Boolean),
    weeks: r.weeks.map(w => ({ label: cwLabel(w.key), range: `${fmtShort(w.days[0])} – ${fmtShort(w.days[w.days.length - 1])}`, pct: w.pct, color: weekNum(w.key) % 6 })),
    heat: { type: 'month', weekdays: wdNames, rows: r.weeks.map(w => {
      const first = weekdayIdx(w.days[0]);
      return { label: cwLabel(w.key), color: weekNum(w.key) % 6, cells: [...Array(7)].map((_, i) => { const d = w.days[i - first]; if (!d) return null; const x = r.ms.days.find(z => z.d === d); return { day: parse(d).getDate(), pct: x.total ? x.pct : null, future: x.future }; }) };
    }) },
    habits: [...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => ({ name: habitName(p.h), pct: p.done / p.total, detail: habitDetail(p) })),
    lists: [
      { title: tr('Weekly habits'), items: r.weekly.map(w => [w.name, `${w.n} / ${w.of}`]) },
      { title: tr('Training and tasks'), items: [[tr('Workouts'), String(r.workouts)], [tr('Exercises done'), String(r.exDone)], [tr('kg moved'), Math.round(r.kg).toLocaleString(LOC())], [tr('Tasks completed'), String(r.tasksDone)]] },
    ],
    goals: r.goals.map(g => ({ title: g.data.title, done: !!g.data.done })),
  };
}
export function yearPdfData(Y) {
  const y = +Y, ys = yearStats(y);
  const withData = ys.per.filter(p => p.total);
  const best = [...withData].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total)[0];
  const bestMonth = ys.months.filter(m2 => m2.pct != null).sort((a2, b2) => b2.pct - a2.pct)[0];
  const longest = [...withData].sort((a2, b2) => b2.best - a2.best)[0];
  const mName = (m2, f = 'short') => new Date(y, m2, 1).toLocaleDateString(LOC(), { month: f });
  return {
    kicker: tr('Year in review'), title: tr('Your year {y}', { y }), filename: `${tr('Review')}-${y}.pdf`, footer: pdfFooter(), labels: pdfLabels(),
    stats: [[tr('habits completed'), pct(ys.pct)], [tr('perfect days'), String(ys.perfect)], [tr('check-ins'), ys.checkins.toLocaleString(LOC())], [tr('workouts'), String(ys.workouts)]],
    highlights: [best && [tr('Most consistent'), best.h.data.name, pct(best.done / best.total)], bestMonth && [tr('Best month'), mName(bestMonth.m, 'long'), pct(bestMonth.pct)],
      longest && longest.best && [tr('Longest streak'), longest.h.data.name, tr('{n} days', { n: longest.best })]].filter(Boolean),
    heat: { type: 'year', rows: ys.months.map(mo => ({ label: mName(mo.m), end: mo.pct == null ? '' : pct(mo.pct), cells: [...Array(31)].map((_, i) => { const x = mo.days[i]; return x ? { pct: x.future ? null : x.pct, future: !!x.future } : null; }) })) },
    habits: [...withData].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => ({ name: habitName(p.h), pct: p.done / p.total, detail: habitDetail(p) })),
    lists: [
      { title: tr('Workouts per month'), items: ys.wmonths.map((n2, m2) => [mName(m2, 'long'), String(n2)]).filter(([, v]) => v !== '0') },
      { title: tr('Training and tasks'), items: [[tr('Workouts'), String(ys.workouts)], [tr('kg moved'), Math.round(ys.kg).toLocaleString(LOC())], [tr('Tasks completed'), String(ys.tasksDone)], [tr('Goals reached'), `${ys.goalsDone} / ${ys.goals}`]] },
    ],
    goals: [],
  };
}

/* ---------- exercise progress ---------- */
export function exerciseHistory() {
  const map = new Map();
  list('workout').forEach(r => {
    const d = r.data.date || r.id.slice(8);
    (r.data.exercises || []).forEach(e => {
      const name = (e.name || '').trim();
      if (!e.done || !name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, sessions: [] });
      map.get(key).sessions.push({ d, w: +e.weight || 0, sets: +e.sets || 0, reps: +e.reps || 0 });
    });
  });
  return [...map.values()].map(x => ({ ...x, sessions: x.sessions.sort((p, q) => p.d.localeCompare(q.d)) })).sort((p, q) => q.sessions.length - p.sessions.length);
}
export function progressChart(sessions, metric) {
  const pts = sessions.slice(-120), W = 320, H = 160, P = 30;
  const vals = pts.map(s => metric(s)), lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1, x = i => P + (pts.length === 1 ? (W - P - 10) / 2 : i * (W - P - 10) / (pts.length - 1)), y = v => H - 24 - (v - lo) / span * (H - 48);
  const path = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
  const ticks = [lo, lo + span / 2, hi].map(v => Math.round(v * 10) / 10);
  const labels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, arr) => arr.indexOf(v) === i)
    .map((i, k, arr) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="10" fill="var(--muted)" text-anchor="${k === 0 && arr.length > 1 ? 'start' : k === arr.length - 1 && arr.length > 1 ? 'end' : 'middle'}">${fmtShort(pts[i].d)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${tr('Progress chart')}">
    ${ticks.map(v => `<line x1="${P}" x2="${W - 6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="2" y="${(y(v) + 4).toFixed(1)}" font-size="10" fill="var(--muted)">${v}</text>`).join('')}
    <path d="${path} L${x(pts.length - 1).toFixed(1)},${H - 24} L${x(0).toFixed(1)},${H - 24} Z" fill="var(--sage-soft)" opacity=".55"/>
    <path d="${path}" fill="none" stroke="var(--sage)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="${i === pts.length - 1 ? 5 : pts.length > 40 ? 1.8 : 3}" fill="${i === pts.length - 1 ? 'var(--ochre)' : 'var(--sage)'}"><title>${fmtShort(s.d)}: ${vals[i]}</title></circle>`).join('')}
    ${labels}</svg>`;
}
export function viewProgress() {
  const all = exerciseHistory();
  if (!S.exercise) {
    return `<header class="page-head with-nav"><a class="icon-btn" href="#train" aria-label="${tr('Back to training')}">‹</a><h1>${tr('Progress')}</h1></header>
    ${all.length ? `<div class="project-grid">${all.map(ex => {
      const s = ex.sessions, last = s[s.length - 1], first = s[0], byW = s.some(z => z.w);
      const diff = byW ? last.w - first.w : last.reps - first.reps;
      return `<a class="panel project" href="#progress/${encodeURIComponent(ex.name)}">
        <span class="pname">${esc(ex.name)}</span>
        <span class="muted">${tr(s.length === 1 ? '{n} session' : '{n} sessions', { n: s.length })}</span>
        <span class="figure">${byW ? `${last.w} kg` : tr('{n} reps', { n: last.reps })}</span>
        ${s.length > 1 && diff ? `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ −'}${Math.abs(Math.round(diff * 10) / 10)}${byW ? ' kg' : ''} ${tr('since {date}', { date: fmtShort(first.d) })}</span>` : ''}
      </a>`;
    }).join('')}</div>` : `<section class="panel"><p class="note">${tr('Check off exercises in your training plan, and their progress shows up here.')}</p></section>`}`;
  }
  const ex = all.find(z => z.name.toLowerCase() === S.exercise.toLowerCase());
  if (!ex) return `<header class="page-head with-nav"><a class="icon-btn" href="#progress" aria-label="${tr('Back')}">‹</a><h1>${esc(S.exercise)}</h1></header><section class="panel"><p class="note">${tr('No completed sessions yet.')}</p></section>`;
  const s = ex.sessions, byW = s.some(z => z.w), metric = byW ? z => z.w : z => z.reps;
  const last = s[s.length - 1], first = s[0], best = s.reduce((b, z) => (metric(z) > metric(b) ? z : b), s[0]);
  const diff = metric(last) - metric(first);
  const fmt = z => `${z.w ? `${z.w} kg · ` : ''}${z.sets || 1} × ${z.reps || '–'}`;
  return `
  <header class="page-head with-nav"><a class="icon-btn" href="#progress" aria-label="${tr('Back')}">‹</a>
    <div class="head-stack"><p class="sub">${tr('Exercise progress')}</p><h1>${esc(ex.name)}</h1></div></header>
  <div class="summary">
    <div><span class="figure">${byW ? `${last.w} kg` : last.reps}</span><span class="muted">${tr(byW ? 'current weight' : 'current reps')}</span></div>
    ${s.length > 1 ? `<div><span class="figure">${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}${byW ? ' kg' : ''}</span><span class="muted">${tr('since {date}', { date: fmtShort(first.d) })}</span></div>` : ''}
    <div><span class="figure">${s.length}</span><span class="muted">${tr('sessions')}</span></div>
  </div>
  <section class="panel">${s.length > 1 ? progressChart(s, metric) : `<p class="note">${tr('The chart appears after your second session.')}</p>`}
    <p class="note">${tr('Best: {what} on {date}', { what: fmt(best), date: fmtShort(best.d) })}</p></section>
  <section class="panel" style="margin-top:14px"><h2>${tr('Last sessions')}</h2>
    <dl class="stats">${s.slice(-6).reverse().map(z => `<div><dt>${parse(z.d).toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short' })}</dt><dd class="small-dd">${fmt(z)}</dd></div>`).join('')}</dl></section>`;
}

/* ---------- year overview ---------- */
export function yearStats(y) {
  const t = today(), hs = allHabits();
  const months = [];
  let done = 0, total = 0, perfect = 0, checkins = 0;
  const allDays = [];
  for (let m = 0; m < 12; m++) {
    const n = daysInMonth(y, m), days = [];
    let md = 0, mt = 0;
    for (let i = 1; i <= n; i++) {
      const d = `${y}-${pad(m + 1)}-${pad(i)}`;
      allDays.push(d);
      if (d > t) { days.push({ d, future: true }); continue; }
      const s = dayStats(d, hs);
      days.push({ d, pct: s.total ? s.pct : null });
      md += s.done; mt += s.total; checkins += s.checkins;
      if (s.all) perfect++;
    }
    done += md; total += mt;
    months.push({ m, days, pct: mt ? md / mt : null });
  }
  const per = hs.map(h => ({ h, ...habitPeriod(h, allDays) }));
  // training
  const wmonths = Array(12).fill(0);
  let workouts = 0, kg = 0;
  list('workout').forEach(r => {
    const d = r.data.date || r.id.slice(8);
    if (!d || !d.startsWith(`${y}-`)) return;
    const ex = r.data.exercises || [], ca = r.data.cardio || [];
    if (ex.some(e => e.done) || ca.some(e => e.done)) { workouts++; wmonths[+d.slice(5, 7) - 1]++; }
    ex.forEach(e => { if (e.done) kg += (+e.weight || 0) * (+e.sets || 0) * (+e.reps || 0); });
  });
  const tasksDone = list('task').filter(x => x.data.done && (x.data.doneAt || x.updated_at || '').startsWith(`${y}`)).length;
  const goals = list('goal').filter(g => (g.data.month || '').startsWith(`${y}-`));
  return { months, done, total, perfect, checkins, pct: total ? done / total : 0, per, wmonths, workouts, kg, tasksDone, goals: goals.length, goalsDone: goals.filter(g => g.data.done).length };
}

export function viewYear() {
  const y = S.year, ys = yearStats(y), prev = yearStats(y - 1);
  const hasPrev = prev.total > 0 && ys.total > 0;
  const monthName = m => new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'short' });
  const lvl = p => p == null ? 'l0' : p === 0 ? 'l0 miss' : p < 0.34 ? 'l1' : p < 0.67 ? 'l2' : p < 1 ? 'l3' : 'l4';
  const heat = ys.months.map(mo => `<tr><th scope="row">${monthName(mo.m)}</th>${[...Array(31)].map((_, i) => {
      const x = mo.days[i];
      if (!x) return '<td></td>';
      return `<td><span class="hc ${x.future ? 'fut' : lvl(x.pct)}" title="${fmtShort(x.d)}${x.pct != null && !x.future ? `: ${pct(x.pct)}` : ''}"></span></td>`;
    }).join('')}<td class="hp">${mo.pct == null ? '' : pct(mo.pct)}</td></tr>`).join('');
  const withData = ys.per.filter(p => p.total);
  const best = [...withData].sort((a, b) => b.done / b.total - a.done / a.total)[0];
  const bestMonth = ys.months.filter(m => m.pct != null).sort((a, b) => b.pct - a.pct)[0];
  const longest = [...withData].sort((a, b) => b.best - a.best)[0];
  const maxW = Math.max(1, ...ys.wmonths);
  const highlights = [
    best ? [tr('Most consistent'), `${esc(best.h.data.name)}`, pct(best.done / best.total)] : null,
    bestMonth ? [tr('Best month'), new Date(y, bestMonth.m, 1).toLocaleDateString(LOC(), { month: 'long' }), pct(bestMonth.pct)] : null,
    longest && longest.best ? [tr('Longest streak'), esc(longest.h.data.name), tr('{n} days', { n: longest.best })] : null,
  ].filter(Boolean);
  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="year" data-dir="-1" aria-label="${tr('Previous year')}">‹</button>
    <h1>${tr('Your year {y}', { y })}</h1>
    <button class="icon-btn" data-action="year" data-dir="1" aria-label="${tr('Next year')}">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${pct(ys.pct)}</span><span class="muted">${tr('habits completed')}</span>${hasPrev ? delta(ys.pct, prev.pct, String(y - 1)) : ''}</div>
    <div><span class="figure">${ys.perfect}</span><span class="muted">${tr('perfect days')}</span>${hasPrev ? delta(ys.perfect, prev.perfect, '', false) : ''}</div>
    <div><span class="figure">${ys.checkins.toLocaleString(LOC())}</span><span class="muted">${tr('check-ins')}</span></div>
    <div><span class="figure">${ys.workouts}</span><span class="muted">${tr('workouts')}</span></div>
    <span class="summary-actions"><button class="btn primary" data-action="pdf" data-kind="year" data-p="${y}">${tr('Save as PDF')}</button></span>
  </div>
  ${highlights.length ? `<div class="highlights">${highlights.map(([k, v, n]) => `<div class="panel hl"><span class="muted">${k}</span><span class="hl-v">${v}</span><span class="figure">${n}</span></div>`).join('')}</div>` : ''}
  <section class="panel flush year-panel">
    <div class="panel-head pad"><h2>${tr('Every day of the year')}</h2></div>
    <div class="grid-scroll"><table class="heat"><tbody>${heat}</tbody></table></div>
    <p class="note pad legend"><span class="hc l0"></span>${tr('none')} <span class="hc l1"></span><span class="hc l2"></span><span class="hc l3"></span><span class="hc l4"></span>${tr('all habits')}</p>
  </section>
  <div class="two-col">
    <section class="panel">
      <h2>${tr('Habits this year')}</h2>
      ${withData.length ? `<ul class="year-habits">${withData.sort((a, b) => b.done / b.total - a.done / a.total).map(p => `<li>
        <span class="label">${esc(areaInfo(p.h.data.area).icon)} ${esc(habitName(p.h))}</span><span class="num">${pct(p.done / p.total)}</span>
        ${meter(p.done / p.total, habitName(p.h))}
        <span class="muted">${habitDetail(p)}</span></li>`).join('')}</ul>` : `<p class="note">${tr('No habit data for this year yet.')}</p>`}
    </section>
    <section class="panel">
      <h2>${tr('Training and tasks')}</h2>
      <div class="mini-bars" aria-label="${tr('Workouts per month')}">${ys.wmonths.map((n, m) => `<div><span class="mb" style="--h:${Math.round(n / maxW * 100)}%" title="${n}"></span><small>${monthName(m).slice(0, 1)}</small></div>`).join('')}</div>
      <dl class="stats">
        <div><dt>${tr('Workouts')}</dt><dd>${ys.workouts}</dd></div>
        <div><dt>${tr('kg moved')}</dt><dd>${Math.round(ys.kg).toLocaleString(LOC())}</dd></div>
        <div><dt>${tr('Tasks completed')}</dt><dd>${ys.tasksDone}</dd></div>
        <div><dt>${tr('Goals reached')}</dt><dd>${ys.goalsDone}<small>/${ys.goals}</small></dd></div>
      </dl>
    </section>
  </div>`;
}

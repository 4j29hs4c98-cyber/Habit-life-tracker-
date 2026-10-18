// views/habits.js
import { tr, LOC } from '../i18n.js';
import { $, S, addDays, gridMode, mondayOf, ymd, activeOn, allAreas, areaInfo, cwLabel, delta, esc, fmtShort, habitPeriod, habits, isDone, isMini, isWeekly, list, meter, monthKey, monthStats, monthWeeks, parse, pct, scheduledOn, streakInfo, today, valueOn, weekCls, weekKey, weekNum } from '../core.js';
import { insightsPanel } from './stats.js';
import { weekStrip } from './strip.js';

// One habit cell (used by both the month grid and the week grid).
function cellBtn(h, d, t, cov, future) {
  const done = isDone(h.id, d), mini = isMini(h.id, d), sched = isWeekly(h) || scheduledOn(h, d) || !activeOn(h, d);
  const free = !done && cov.has(d);
  return `<button class="cell ${done ? (mini ? 'mini' : 'on') : ''} ${sched ? '' : 'off'} ${free ? 'free' : ''}" data-mode="cycle" data-action="toggle" data-h="${h.id}" data-d="${d}" ${future ? 'disabled' : ''} aria-pressed="${done}" aria-label="${esc(h.data.name)}, ${fmtShort(d)}${mini ? ' (' + tr('mini') + ')' : ''}${free ? ' (' + tr('free day') + ')' : ''}">${free ? 'R' : ''}</button>`;
}

// The week shown in the week grid: the chosen week, else the current week if it's in the shown month, else the month's first week.
export function shownWeek() {
  const first = new Date(S.month.getFullYear(), S.month.getMonth(), 1), last = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 0);
  const overlaps = mon => mon <= last && addDays(mon, 6) >= first;
  if (S.gridWeek && overlaps(S.gridWeek)) return S.gridWeek;
  const now = mondayOf(new Date());
  S.gridWeek = overlaps(now) ? now : mondayOf(first);
  return S.gridWeek;
}

function weekGrid(hs, t) {
  const mon = shownWeek(), days = [...Array(7)].map((_, i) => ymd(addDays(mon, i))), key = weekKey(days[0]);
  const head = days.map(d => `<span class="wg-day ${d === t ? 'is-today' : ''}"><span class="wd">${parse(d).toLocaleDateString(LOC(), { weekday: 'short' })}</span><span class="dn">${parse(d).getDate()}</span></span>`).join('');
  const rows = hs.map(h => {
    const cov = streakInfo(h.id).covered;
    const hp = habitPeriod(h, days.filter(d => d <= t));
    const count = hp.weeks ? `${hp.done}<small>/${hp.total} ${tr('wk')}</small>` : `${hp.checkins}<small>/${hp.total}</small>`;
    return `<li class="wg-habit">
      <div class="wg-top"><button class="wg-name" data-action="edit-habit" data-id="${h.id}" title="${tr('Edit habit')}"><span aria-hidden="true">${esc(areaInfo(h.data.area).icon)}</span>${esc(h.data.name)}</button><span class="hcount">${count}</span></div>
      <div class="wg-cells">${days.map(d => `<span class="wg-cell ${d === t ? 'is-today' : ''}">${cellBtn(h, d, t, cov, d > t)}</span>`).join('')}</div></li>`;
  }).join('');
  return `<section class="panel week-grid ${weekCls(key)}" data-swipe="grid-week">
    <div class="wg-head">
      <button class="icon-btn" data-action="grid-week" data-dir="-1" aria-label="${tr('Previous week')}">‹</button>
      <div class="wg-title"><span class="wk-chip ${weekCls(key)}">${cwLabel(key)}</span><span class="muted">${fmtShort(days[0])} – ${fmtShort(days[6])}</span></div>
      <button class="icon-btn" data-action="grid-week" data-dir="1" aria-label="${tr('Next week')}">›</button>
    </div>
    ${weekStrip(mon, S.planDay || t, { pick: 'plan-day-go', week: 'grid-week', arrows: false, cls: 'in-grid' })}
    <ul class="wg-list">${rows}</ul>
  </section>`;
}
const gridToggle = () => `<div class="grid-toolbar"><div class="seg" role="radiogroup" aria-label="${tr('Grid view')}">${['week', 'month'].map(v => `<button role="radio" aria-checked="${gridMode() === v}" data-action="grid-mode" data-v="${v}">${tr(v === 'week' ? 'Week' : 'Month')}</button>`).join('')}</div></div>`;

export function viewHabits() {
  const y = S.month.getFullYear(), m = S.month.getMonth(), t = today(), mk = monthKey(S.month);
  const ms = monthStats(y, m), hs = habits();
  const monthName = S.month.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
  const pmDate = new Date(y, m - 1, 1), pms = monthStats(pmDate.getFullYear(), pmDate.getMonth());
  const pmName = pmDate.toLocaleDateString(LOC(), { month: 'long' });
  const hasPrev = pms.total > 0 && ms.total > 0;
  const wd = d => tr('MTWTFSS')[(parse(d).getDay() + 6) % 7];

  const mw = monthWeeks(y, m);
  const wc = d => weekCls(weekKey(d));
  const weekBand = mw.map(w => `<th scope="colgroup" colspan="${w.days.length}" class="wk-band ${weekCls(w.key)}">${w.days.length >= 3 ? cwLabel(w.key) : weekNum(w.key)}</th>`).join('');
  const head = ms.days.map(x => `<th scope="col" class="${wc(x.d)} ${x.d === t ? 'is-today' : ''}"><span class="wd">${wd(x.d)}</span><span class="dn">${parse(x.d).getDate()}</span></th>`).join('');
  const bars = ms.days.map(x => `<td class="${x.d === t ? 'is-today' : ''}"><span class="bar" style="--h:${x.future ? 0 : Math.round(x.pct * 100)}%" title="${x.future ? '' : pct(x.pct)}"></span></td>`).join('');
  const rows = hs.map(h => {
    const cov = streakInfo(h.id).covered;
    const hp = habitPeriod(h, ms.days.map(x => x.d));
    const cells = ms.days.map(x => `<td class="${wc(x.d)} ${x.d === t ? 'is-today' : ''}">${cellBtn(h, x.d, t, cov, x.future)}</td>`).join('');
    return `<tr><th scope="row" class="hname"><button data-action="edit-habit" data-id="${h.id}" title="${tr("Edit habit")}"><span aria-hidden="true">${esc(areaInfo(h.data.area).icon)}</span>${esc(h.data.name)}</button></th>${cells}<td class="hcount">${hp.weeks ? `${hp.done}<small>/${hp.total} ${tr('wk')}</small>` : `${hp.checkins}<small>/${hp.total}</small>`}</td></tr>`;
  }).join('');

  // area breakdown for this month
  const areaList = allAreas();
  if (hs.some(h => !areaList.some(x => x.id === h.data.area))) areaList.push({ id: '__none', label: tr('No area'), icon: '•' });
  const areaRows = areaList.map(a => {
    const ah = hs.filter(h => a.id === '__none' ? !allAreas().some(x => x.id === h.data.area) : h.data.area === a.id);
    if (!ah.length) return '';
    let d = 0, tot = 0;
    ms.days.filter(x => !x.future).forEach(x => ah.forEach(h => { if (scheduledOn(h, x.d)) { tot++; d += valueOn(h.id, x.d); } }));
    return `<li><span>${esc(a.icon)} ${esc(a.label)}</span><span class="muted">${tr(ah.length === 1 ? '{n} habit' : '{n} habits', { n: ah.length })}</span>${meter(tot ? d / tot : 0, a.label)}<span class="num">${tot ? pct(d / tot) : '–'}</span></li>`;
  }).join('');

  // weekly habits
  const weekly = list('weekly_habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const curWeek = weekKey(t);
  const weeklyRows = weekly.map(r => {
    const wk = r.data.weeks || {};
    const n = mw.filter(w => wk[w.key]).length;
    return `<tr><th scope="row" class="hname"><button data-action="edit-weekly" data-id="${r.id}">${esc(r.data.name)}</button></th>
      ${mw.map(w => `<td class="${weekCls(w.key)} ${w.key === curWeek ? 'is-today' : ''}"><button class="cell ${wk[w.key] ? 'on' : ''}" data-action="toggle-week" data-id="${r.id}" data-w="${w.key}" ${w.days[0] > t ? 'disabled' : ''} aria-pressed="${!!wk[w.key]}" aria-label="${esc(r.data.name)}, ${cwLabel(w.key)}"></button></td>`).join('')}
      <td class="hcount">${n}<small>/${mw.length}</small></td></tr>`;
  }).join('');

  // goals
  const goals = list('goal').filter(g => g.data.month === mk).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const goalsDone = goals.filter(g => g.data.done).length;

  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="month" data-dir="-1" aria-label="${tr("Previous month")}">‹</button>
    <h1>${monthName}</h1>
    <button class="icon-btn" data-action="month" data-dir="1" aria-label="${tr("Next month")}">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${pct(ms.pct)}</span><span class="muted">${tr("completed")}</span>${hasPrev ? delta(ms.pct, pms.pct, pmName) : ''}</div>
    <div><span class="figure">${ms.perfect}</span><span class="muted">${tr("perfect days")}</span>${hasPrev ? delta(ms.perfect, pms.perfect, '', false) : ''}</div>
    <div><span class="figure">${ms.checkins}</span><span class="muted">${tr("check-ins")}</span></div>
    <span class="summary-actions"><button class="btn" data-action="open-month" data-m="${mk}">${tr('Month review')}</button><button class="btn" data-action="open-year" data-y="${y}">${tr('Year overview')}</button><button class="btn primary" data-action="new-habit">${tr("Add habit")}</button></span>
  </div>
  ${hs.length ? gridToggle() : ''}
  ${hs.length && gridMode() === 'week' ? weekGrid(hs, t) : hs.length ? `
  <section class="panel flush">
    <div class="grid-scroll">
      <table class="habit-grid">
        <thead>
          <tr class="bars"><th scope="row" class="hname muted">${tr("Daily")}</th>${bars}<td></td></tr>
          <tr class="weeks"><th class="hname"></th>${weekBand}<td></td></tr>
          <tr><th scope="col" class="hname">${tr("Habit")}</th>${head}<th scope="col" class="hcount">${tr("Done")}</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>` : `<section class="panel"><div class="empty"><p>${tr("No habits yet. Add your own, or start with a set of common ones you can edit.")}</p>
    <div class="row"><button class="btn primary" data-action="new-habit">${tr("Add a habit")}</button><button class="btn" data-action="starter">${tr("Use starter set")}</button></div></div></section>`}

  <div class="two-col">
    <section class="panel">
      <div class="panel-head"><h2>${tr("Weekly habits")}</h2><button class="btn small" data-action="new-weekly">${tr("Add")}</button></div>
      ${weekly.length ? `<div class="grid-scroll"><table class="habit-grid weekly"><thead><tr><th class="hname">${tr("Habit")}</th>${mw.map(w => `<th scope="col" class="wk-head ${weekCls(w.key)}"><span class="dn">${cwLabel(w.key)}</span><span class="wd">${parse(w.days[0]).getDate()}.–${parse(w.days[w.days.length - 1]).getDate()}.</span></th>`).join('')}<th class="hcount">${tr("Done")}</th></tr></thead><tbody>${weeklyRows}</tbody></table></div>`
      : `<p class="note">${tr("Things you do once a week, like laundry or meal prep.")} <button class="link" data-action="starter-weekly">${tr("Add a few examples")}</button></p>`}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${tr('Goals for {month}', { month: S.month.toLocaleDateString(LOC(), { month: 'long' }) })}</h2><button class="btn small" data-action="new-goal">${tr("Add")}</button></div>
      ${goals.length ? `${meter(goals.length ? goalsDone / goals.length : 0, tr('Goals done'))}<p class="note">${tr('{done} of {total} reached', { done: goalsDone, total: goals.length })}</p>
        <ul class="checklist">${goals.map(g => `<li class="with-del"><button class="check-row ${g.data.done ? 'is-done' : ''}" data-action="toggle-goal" data-id="${g.id}" aria-pressed="${!!g.data.done}"><span class="box" aria-hidden="true"></span><span class="label">${esc(g.data.title)}</span></button><button class="icon-btn quiet" data-action="del-goal" data-id="${g.id}" aria-label="${tr("Delete goal")}">×</button></li>`).join('')}</ul>`
      : `<p class="note">${tr('Set a few goals for the month, like "Read one book".')}</p>`}
    </section>
    <section class="panel span-2"><div class="panel-head"><h2>${tr("By area")}</h2><button class="btn small" data-action="areas">${tr('Manage areas')}</button></div>
      ${areaRows ? `<ul class="area-list">${areaRows}</ul>` : `<p class="note">${tr('Group your habits into areas like Health or Music. Add your own with "Manage areas".')}</p>`}</section>
    ${hs.length ? insightsPanel() : ''}
  </div>`;
}

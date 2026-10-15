import * as db from './db.js';
import * as sync from './sync.js';
import * as push from './push.js';
import { tr, setLang, getLang, LOC } from './i18n.js';
import { reviewPdf } from './pdf.js';
import * as att from './attach.js';

/* ---------- constants ---------- */
const BUILTIN_AREAS = {
  health:       { label: 'Health',        icon: '🫀' },
  mind:         { label: 'Mind',          icon: '🧘' },
  productivity: { label: 'Productivity',  icon: '🎯' },
  lifestyle:    { label: 'Lifestyle',     icon: '🌿' },
  work:         { label: 'Work & school', icon: '📚' },
  finance:      { label: 'Finance',       icon: '💶' },
};
const AREA_EMOJIS = ['🎨', '🎸', '⚽', '🧠', '💼', '🏠', '❤️', '🌍', '✈️', '🐶', '🍎', '📖', '🙏', '💤', '🧹', '👨‍👩‍👧'];
const STARTER = [
  ['Drink 2 L of water', 'health'], ['Morning stretching', 'health'],
  ['Read 10 pages', 'mind'], ['Plan tomorrow', 'productivity'],
  ['Deep work session', 'work'], ['Make the bed', 'lifestyle'],
  ['Track expenses', 'finance'],
];
const STARTER_WEEKLY = ['Meal prep for the week', 'Do laundry', 'Clean my room', 'Review my budget'];
const EXERCISES = ['Barbell bench press', 'Incline bench press', 'Push-ups', 'Dips', 'Tricep pushdown',
  'Pull-ups', 'Seated row', 'Lat pulldown', 'Bicep curl', 'Squat', 'Deadlift', 'Leg press',
  'Lunges', 'Shoulder press', 'Lateral raise', 'Plank'];
const CARDIO = ['Treadmill', 'Jogging', 'Cycling', 'Rowing', 'Swimming', 'Jump rope'];
const VIEWS = ['today', 'habits', 'tasks', 'train', 'more', 'plan', 'year', 'month'];

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const mondayOf = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const pct = v => `${Math.round(v * 100)}%`;
const fmtShort = s => parse(s).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' });

/* ---------- state + storage ---------- */
const S = {
  recs: new Map(),
  view: 'today',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  week: mondayOf(new Date()),
  taskTab: 'today',
  year: new Date().getFullYear(),
  reviewMonth: monthKey(new Date()),
  installPrompt: null,
  push: { perm: 'default', sub: false, busy: false },
};

const list = kind => [...S.recs.values()].filter(r => r.kind === kind && !r.deleted);
const get = id => { const r = S.recs.get(id); return r && !r.deleted ? r : null; };

async function save(kind, id, data) {
  const rec = { id, kind, data, updated_at: new Date().toISOString(), deleted: false, synced: false };
  S.recs.set(id, rec);
  await db.put(rec);
  sync.schedule();
  return rec;
}
async function remove(id) {
  const r = S.recs.get(id);
  if (!r) return;
  const rec = { ...r, deleted: true, updated_at: new Date().toISOString(), synced: false };
  S.recs.set(id, rec);
  await db.put(rec);
  sync.schedule();
}

/* ---------- habit logic ---------- */
const habits = () => list('habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
const logId = (h, d) => `log_${h}_${d}`;
const isDone = (h, d) => !!get(logId(h, d))?.data.done;
const activeOn = (h, d) => !h.data.start || h.data.start <= d;

function dayStats(d, hs = habits()) {
  const el = hs.filter(h => activeOn(h, d));
  const done = el.filter(h => isDone(h.id, d)).length;
  return { done, total: el.length, pct: el.length ? done / el.length : 0 };
}
function streak(hid) {
  let d = new Date();
  if (!isDone(hid, ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (isDone(hid, ymd(d)) && n < 5000) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak(hid) {
  const dates = list('habit_log').filter(r => r.data.habitId === hid && r.data.done).map(r => r.data.date).sort();
  let best = 0, cur = 0, prev = null;
  for (const ds of dates) {
    cur = prev && ymd(addDays(parse(prev), 1)) === ds ? cur + 1 : 1;
    best = Math.max(best, cur); prev = ds;
  }
  return best;
}
function monthStats(y, m) {
  const n = daysInMonth(y, m), t = today(), hs = habits();
  let done = 0, total = 0, perfect = 0;
  const days = [];
  for (let i = 1; i <= n; i++) {
    const d = `${y}-${pad(m + 1)}-${pad(i)}`;
    const s = dayStats(d, hs);
    const future = d > t;
    days.push({ d, ...s, future });
    if (!future) { done += s.done; total += s.total; if (s.total && s.done === s.total) perfect++; }
  }
  return { days, done, total, perfect, pct: total ? done / total : 0 };
}

/* ---------- calendar weeks ---------- */
function isoWeek(dt) {
  const x = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return { year: x.getUTCFullYear(), week: Math.ceil(((x - y0) / 864e5 + 1) / 7) };
}
const weekKey = d => { const w = isoWeek(typeof d === 'string' ? parse(d) : d); return `${w.year}-W${pad(w.week)}`; };
const weekNum = key => +key.slice(-2);
const weekCls = key => `wk${weekNum(key) % 6}`; // same color for the same calendar week everywhere
const cwLabel = key => tr('CW {n}', { n: weekNum(key) });
function monthWeeks(y, m) { // calendar weeks touching this month, with their days
  const out = [];
  for (let i = 1; i <= daysInMonth(y, m); i++) {
    const d = `${y}-${pad(m + 1)}-${pad(i)}`, k = weekKey(d);
    if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, days: [] });
    out[out.length - 1].days.push(d);
  }
  return out;
}
// Weekly habits store ticks per calendar week ({ '2026-W42': true }). Older data stored ticks per
// "week of the month"; it is converted once when the app starts.
async function migrateWeekly() {
  for (const r of list('weekly_habit')) {
    if (r.data.weeks || !r.data.checks || !Object.keys(r.data.checks).length) continue;
    const weeks = {};
    for (const [mk, arr] of Object.entries(r.data.checks)) {
      const [yy, mm] = mk.split('-').map(Number);
      (arr || []).forEach((on, i) => { if (on) weeks[weekKey(new Date(yy, mm - 1, Math.min(1 + 7 * i, daysInMonth(yy, mm - 1))))] = true; });
    }
    await save('weekly_habit', r.id, { ...r.data, weeks });
  }
}

/* ---------- small UI pieces ---------- */
const meter = (v, label = '') => `<div class="meter" role="progressbar" aria-valuenow="${Math.round(v * 100)}" aria-valuemin="0" aria-valuemax="100" ${label ? `aria-label="${esc(label)}"` : ''}><span style="width:${Math.round(v * 100)}%"></span></div>`;
// Areas: the built-in ones (which can be renamed or removed) plus your own.
function allAreas() {
  const out = [];
  Object.entries(BUILTIN_AREAS).forEach(([k, a], i) => {
    const o = get('area_' + k)?.data;
    if (o?.hidden) return;
    out.push({ id: k, label: o?.name || tr(a.label), icon: o?.icon || a.icon, builtin: true, order: o?.order ?? i });
  });
  list('area').filter(r => r.data.custom).forEach(r => out.push({ id: r.id, label: r.data.name, icon: r.data.icon || '🏷️', order: r.data.order ?? 100 }));
  return out.sort((x, y) => x.order - y.order);
}
const areaInfo = id => allAreas().find(x => x.id === id) || { id: '', label: tr('No area'), icon: '•' };
const areaOptions = sel => allAreas().map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.icon)} ${esc(x.label)}</option>`).join('')
  + `<option value="" ${!allAreas().some(x => x.id === sel) ? 'selected' : ''}>• ${tr('No area')}</option>`;
const projectOptions = sel => `<option value="">${tr("No project")}</option>` + list('project').map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.data.name)}</option>`).join('');

function toast(msg) {
  const t = $('#toast');
  t.textContent = tr(msg);
  t.classList.add('show');
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => t.classList.remove('show'), 2200);
}
function openModal(html) {
  const m = $('#modal');
  $('#modal-body').innerHTML = html;
  if (!m.open) m.showModal();
  const first = m.querySelector('input, select, textarea');
  if (first) first.focus();
}
const closeModal = () => $('#modal').close();

function agoText(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? tr('just now') : m < 60 ? tr('{n} min ago', { n: m }) : m < 1440 ? tr('{n} h ago', { n: Math.round(m / 60) }) : fmtShort(ymd(new Date(iso)));
}

/* ---------- views ---------- */
function viewToday() {
  const now = new Date(), t = today();
  const hs = habits().filter(h => activeOn(h, t));
  const ds = dayStats(t);
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const streaks = habits().map(h => ({ h, s: streak(h.id) })).sort((a, b) => b.s - a.s);
  const top = streaks[0];
  const due = list('task').filter(x => !x.data.done && x.data.due && x.data.due <= t).sort((a, b) => a.data.due.localeCompare(b.data.due));
  const w = workoutFor(t).w;

  const habitList = hs.length ? `<ul class="checklist">${hs.map(h => {
    const done = isDone(h.id, t), s = streak(h.id);
    return `<li><button class="check-row ${done ? 'is-done' : ''}" data-action="toggle" data-h="${h.id}" data-d="${t}" aria-pressed="${done}">
      <span class="box" aria-hidden="true"></span><span class="label">${esc(h.data.name)}</span>
      ${s ? `<span class="streak" title="${tr("Current streak")}">${tr(s === 1 ? '{n} day' : '{n} days', { n: s })}</span>` : ''}</button></li>`;
  }).join('')}</ul>` : `<div class="empty"><p>${tr("No habits yet. Add your own, or start with a set of common ones you can edit.")}</p>
      <div class="row"><button class="btn primary" data-action="new-habit">${tr("Add a habit")}</button><button class="btn" data-action="starter">${tr("Use starter set")}</button></div></div>`;

  return `
  <header class="page-head">
    <p class="sub">${now.toLocaleDateString(LOC(), { weekday: 'long' })}</p>
    <h1>${now.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' })}</h1>
  </header>
  <div class="today-layout">
    <section class="panel span-2">
      <div class="panel-head"><h2>${tr("Habits today")}</h2><p class="figure">${ds.done}<small> ${tr('of')} ${ds.total}</small></p></div>
      ${meter(ds.pct, tr('Habits done today'))}
      ${habitList}
    </section>
    ${(now.getMonth() === 11 && now.getDate() >= 15) || (now.getMonth() === 0 && now.getDate() <= 15) ? `<a class="panel year-card" href="#year" data-action="open-year" data-y="${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}"><span class="muted">${tr('Year in review')}</span><span class="hl-v">${tr('Your year {y} is ready', { y: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() })}</span></a>` : ''}
    ${now.getDate() <= 5 ? (() => { const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `<button class="panel year-card" data-action="open-month" data-m="${monthKey(pm)}"><span class="muted">${tr('Monthly review')}</span><span class="hl-v">${tr('Your {month} review is ready', { month: pm.toLocaleDateString(LOC(), { month: 'long' }) })}</span></button>`; })() : ''}
    <section class="panel">
      <h2>${tr("This month")}</h2>
      <dl class="stats">
        <div><dt>${tr("Completed")}</dt><dd>${pct(ms.pct)}</dd></div>
        <div><dt>${tr("Perfect days")}</dt><dd>${ms.perfect}</dd></div>
        <div><dt>${tr("Longest streak now")}</dt><dd>${top && top.s ? tr('{n} d', { n: top.s }) : '–'}</dd></div>
      </dl>
      ${top && top.s ? `<p class="note">${tr('{name} leads.', { name: esc(top.h.data.name) })}</p>` : ''}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${tr("Due today")}</h2><button class="btn small" data-action="new-task" data-due="${t}">${tr("Add task")}</button></div>
      ${due.length ? `<ul class="task-list">${due.map(taskRow).join('')}</ul>` : `<p class="note">${tr("Nothing due. Plan something on the Tasks tab.")}</p>`}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${tr("Training")}</h2><a class="btn small" href="#train">${tr("Open")}</a></div>
      ${w && (w.exercises?.length || w.cardio?.length) ? `
        <p class="lead">${esc((w.groups || []).join(', ') || tr('Workout planned'))}</p>
        <p class="note">${tr('{done} of {total} exercises done', { done: (w.exercises || []).filter(e => e.done).length, total: (w.exercises || []).length })}${w.cardio?.length ? tr(', {n} cardio', { n: w.cardio.length }) : ''}</p>`
      : `<p class="note">${tr("Rest day, or nothing planned yet.")}</p>`}
    </section>
  </div>`;
}

function viewHabits() {
  const y = S.month.getFullYear(), m = S.month.getMonth(), t = today(), mk = monthKey(S.month);
  const ms = monthStats(y, m), hs = habits();
  const monthName = S.month.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
  const wd = d => tr('MTWTFSS')[(parse(d).getDay() + 6) % 7];

  const mw = monthWeeks(y, m);
  const wc = d => weekCls(weekKey(d));
  const weekBand = mw.map(w => `<th scope="colgroup" colspan="${w.days.length}" class="wk-band ${weekCls(w.key)}">${w.days.length >= 3 ? cwLabel(w.key) : weekNum(w.key)}</th>`).join('');
  const head = ms.days.map(x => `<th scope="col" class="${wc(x.d)} ${x.d === t ? 'is-today' : ''}"><span class="wd">${wd(x.d)}</span><span class="dn">${parse(x.d).getDate()}</span></th>`).join('');
  const bars = ms.days.map(x => `<td class="${x.d === t ? 'is-today' : ''}"><span class="bar" style="--h:${x.future ? 0 : Math.round(x.pct * 100)}%" title="${x.future ? '' : pct(x.pct)}"></span></td>`).join('');
  const rows = hs.map(h => {
    let cnt = 0;
    const cells = ms.days.map(x => {
      const done = isDone(h.id, x.d); if (done) cnt++;
      return `<td class="${wc(x.d)} ${x.d === t ? 'is-today' : ''}"><button class="cell ${done ? 'on' : ''}" data-action="toggle" data-h="${h.id}" data-d="${x.d}" ${x.future ? 'disabled' : ''} aria-pressed="${done}" aria-label="${esc(h.data.name)}, ${fmtShort(x.d)}"></button></td>`;
    }).join('');
    return `<tr><th scope="row" class="hname"><button data-action="edit-habit" data-id="${h.id}" title="${tr("Edit habit")}"><span aria-hidden="true">${esc(areaInfo(h.data.area).icon)}</span>${esc(h.data.name)}</button></th>${cells}<td class="hcount">${cnt}<small>/${ms.days.length}</small></td></tr>`;
  }).join('');

  // area breakdown for this month
  const areaList = allAreas();
  if (hs.some(h => !areaList.some(x => x.id === h.data.area))) areaList.push({ id: '__none', label: tr('No area'), icon: '•' });
  const areaRows = areaList.map(a => {
    const ah = hs.filter(h => a.id === '__none' ? !allAreas().some(x => x.id === h.data.area) : h.data.area === a.id);
    if (!ah.length) return '';
    let d = 0, tot = 0;
    ms.days.filter(x => !x.future).forEach(x => ah.forEach(h => { if (activeOn(h, x.d)) { tot++; if (isDone(h.id, x.d)) d++; } }));
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
    <div><span class="figure">${pct(ms.pct)}</span><span class="muted">${tr("completed")}</span></div>
    <div><span class="figure">${ms.perfect}</span><span class="muted">${tr("perfect days")}</span></div>
    <div><span class="figure">${ms.done}</span><span class="muted">${tr("check-ins")}</span></div>
    <span class="summary-actions"><button class="btn" data-action="open-month" data-m="${mk}">${tr('Month review')}</button><button class="btn" data-action="open-year" data-y="${y}">${tr('Year overview')}</button><button class="btn primary" data-action="new-habit">${tr("Add habit")}</button></span>
  </div>
  ${hs.length ? `
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
  </div>`;
}

function attCount(list) {
  const l = (list || []).filter(a2 => a2.type === 'link').length, f = (list || []).filter(a2 => a2.type === 'file').length;
  return l || f ? `<span class="att-count" title="${tr('Links & documents')}">${l ? `🔗 ${l}` : ''}${l && f ? ' · ' : ''}${f ? `📎 ${f}` : ''}</span>` : '';
}
function taskRow(x) {
  const t = today(), p = x.data.projectId ? get(x.data.projectId) : null;
  const over = x.data.due && x.data.due < t && !x.data.done;
  return `<li class="task ${x.data.done ? 'is-done' : ''}">
    <button class="box-btn" data-action="toggle-task" data-id="${x.id}" aria-pressed="${!!x.data.done}" aria-label="${esc(x.data.title)}: ${tr(x.data.done ? 'mark as not done' : 'mark as done')}"><span class="box" aria-hidden="true"></span></button>
    <button class="task-main" data-action="edit-task" data-id="${x.id}">
      <span class="label">${esc(x.data.title)}</span>
      <span class="meta">${p ? `<span class="chip">${esc(p.data.name)}</span>` : ''}${attCount(x.data.attachments)}${x.data.due ? `<span class="${over ? 'late' : 'muted'}">${over ? tr('Overdue, ') : ''}${x.data.due === t ? tr('today') : fmtShort(x.data.due)}</span>` : ''}</span>
    </button></li>`;
}

function viewTasks() {
  const t = today(), all = list('task');
  const tabs = {
    today: { label: tr('Today'), items: all.filter(x => !x.data.done && x.data.due && x.data.due <= t) },
    upcoming: { label: tr('Upcoming'), items: all.filter(x => !x.data.done && x.data.due && x.data.due > t) },
    someday: { label: tr('No date'), items: all.filter(x => !x.data.done && !x.data.due) },
    done: { label: tr('Done'), items: all.filter(x => x.data.done) },
  };
  const cur = tabs[S.taskTab];
  const items = cur.items.sort((a, b) => S.taskTab === 'done' ? (b.updated_at || '').localeCompare(a.updated_at || '') : (a.data.due || '').localeCompare(b.data.due || ''));
  const projects = list('project');
  return `
  <header class="page-head"><h1>${tr("Tasks")}</h1></header>
  <form class="quick-add" data-form="quick-task">
    <label class="sr" for="qt">${tr("New task")}</label>
    <input id="qt" name="title" placeholder="${tr("Add a task…")}" autocomplete="off" required>
    <input name="due" type="date" value="${S.taskTab === 'today' ? t : ''}" aria-label="${tr("Due date")}">
    <button class="btn primary">${tr("Add")}</button>
  </form>
  <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" aria-selected="${k === S.taskTab}" data-action="task-tab" data-tab="${k}">${v.label}<span class="count">${v.items.length}</span></button>`).join('')}</div>
  <section class="panel">
    ${items.length ? `<ul class="task-list">${items.map(taskRow).join('')}</ul>` : `<p class="note">${tr(S.taskTab === 'done' ? 'Finished tasks show up here.' : 'Nothing here. Add a task above.')}</p>`}
  </section>
  <div class="panel-head section-head"><h2>${tr("Projects")}</h2><button class="btn small" data-action="new-project">${tr("Add project")}</button></div>
  ${projects.length ? `<div class="project-grid">${projects.map(p => {
    const ts = all.filter(x => x.data.projectId === p.id), done = ts.filter(x => x.data.done).length;
    const left = p.data.deadline ? Math.ceil((parse(p.data.deadline) - parse(t)) / 864e5) : null;
    return `<button class="panel project" data-action="edit-project" data-id="${p.id}">
      <span class="pname">${esc(p.data.name)}</span>
      <span class="muted">${tr('{done} of {total} tasks done', { done, total: ts.length })}</span>${attCount(p.data.attachments)}
      ${meter(ts.length ? done / ts.length : 0, p.data.name)}
      ${left !== null ? `<span class="${left < 0 ? 'late' : 'muted'}">${left < 0 ? tr('{n} days late', { n: -left }) : left === 0 ? tr('Due today') : tr('{n} days to go', { n: left })}</span>` : ''}
    </button>`;
  }).join('')}</div>` : `<section class="panel"><p class="note">${tr("Group tasks into projects, like an exam, a trip or a side project.")}</p></section>`}`;
}

/* ---------- training plan ---------- */
const PLAN_ID = 'setting_trainplan';
const planData = () => get(PLAN_ID)?.data || null;
const weekdayIdx = d => (parse(d).getDay() + 6) % 7; // 0 = Monday
const dayHasContent = x => !!x && ((x.exercises || []).length || (x.cardio || []).length);
const hasPlan = () => Object.values(planData()?.days || {}).some(dayHasContent);
function planCopy(d) {
  const p = planData();
  if (!p || d < (p.since || '9999')) return null;
  const day = p.days?.[weekdayIdx(d)];
  if (!dayHasContent(day)) return null;
  return {
    date: d, groups: [...(day.groups || [])], fromPlan: true,
    exercises: (day.exercises || []).map(e => ({ ...e, done: false })),
    cardio: (day.cardio || []).map(e => ({ ...e, done: false })),
  };
}
// What counts for a day: your own entry for that day, otherwise your weekly plan.
function workoutFor(d) {
  const own = get(`workout_${d}`)?.data;
  if (own) return { w: own, fromPlan: false };
  const p = planCopy(d);
  return p ? { w: p, fromPlan: true } : { w: { groups: [], exercises: [], cardio: [] }, fromPlan: false };
}

// One editable day card. key = a date (week view) or "plan-0".."plan-6" (weekly plan).
function dayCard(key, title, sub, w, opts = {}) {
  const plan = key.startsWith('plan-');
  const ck = (l, i, e) => plan ? '' : `<input type="checkbox" ${e.done ? 'checked' : ''} data-w="${key}" data-list="${l}" data-i="${i}" data-k="done" aria-label="${tr('Done')}">`;
  const exRows = (w.exercises || []).map((e, i) => `<tr>
      <td>${ck('exercises', i, e)}</td>
      <td><input list="ex-list" value="${esc(e.name)}" data-w="${key}" data-list="exercises" data-i="${i}" data-k="name" aria-label="${tr('Exercise')}" placeholder="${tr('Exercise')}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.5" value="${esc(e.weight)}" data-w="${key}" data-list="exercises" data-i="${i}" data-k="weight" aria-label="${tr('Weight in kg')}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.sets)}" data-w="${key}" data-list="exercises" data-i="${i}" data-k="sets" aria-label="${tr('Sets')}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.reps)}" data-w="${key}" data-list="exercises" data-i="${i}" data-k="reps" aria-label="${tr('Reps')}"></td>
      <td><input value="${esc(e.rest)}" data-w="${key}" data-list="exercises" data-i="${i}" data-k="rest" aria-label="${tr('Rest')}" placeholder="${tr('1 min')}"></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${key}" data-list="exercises" data-i="${i}" aria-label="${tr('Remove exercise')}">×</button></td></tr>`).join('');
  const caRows = (w.cardio || []).map((e, i) => `<tr>
      <td>${ck('cardio', i, e)}</td>
      <td><input list="cardio-list" value="${esc(e.name)}" data-w="${key}" data-list="cardio" data-i="${i}" data-k="name" aria-label="${tr('Cardio')}" placeholder="${tr('Cardio')}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.time)}" data-w="${key}" data-list="cardio" data-i="${i}" data-k="time" aria-label="${tr('Minutes')}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.speed)}" data-w="${key}" data-list="cardio" data-i="${i}" data-k="speed" aria-label="${tr('Speed km/h')}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.distance)}" data-w="${key}" data-list="cardio" data-i="${i}" data-k="distance" aria-label="${tr('Distance km')}"></td>
      <td></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${key}" data-list="cardio" data-i="${i}" aria-label="${tr('Remove cardio')}">×</button></td></tr>`).join('');
  const hasAny = (w.exercises || []).length || (w.cardio || []).length;
  return `<section class="panel day ${opts.isToday ? 'is-today' : ''}">
      <div class="panel-head"><h2>${title} <span class="muted">${sub}</span></h2>${opts.fromPlan ? `<span class="chip">${tr('From your plan')}</span>` : ''}</div>
      <input class="groups" value="${esc((w.groups || []).join(', '))}" data-w="${key}" data-k="groups" placeholder="${plan ? tr('Rest day, or muscle groups, e.g. Chest') : tr('Muscle groups, e.g. Chest, Triceps')}" aria-label="${tr('Muscle groups')}">
      ${hasAny ? `<div class="grid-scroll"><table class="workout">
        ${(w.exercises || []).length ? `<thead><tr><th></th><th>${tr('Exercise')}</th><th>${tr('kg')}</th><th>${tr('Sets')}</th><th>${tr('Reps')}</th><th>${tr('Rest')}</th><th></th></tr></thead><tbody>${exRows}</tbody>` : ''}
        ${(w.cardio || []).length ? `<thead><tr><th></th><th>${tr('Cardio')}</th><th>${tr('Min')}</th><th>${tr('km/h')}</th><th>${tr('km')}</th><th></th><th></th></tr></thead><tbody>${caRows}</tbody>` : ''}
      </table></div>` : ''}
      <div class="row"><button class="btn small" data-action="add-row" data-w="${key}" data-list="exercises">${tr('Add exercise')}</button><button class="btn small" data-action="add-row" data-w="${key}" data-list="cardio">${tr('Add cardio')}</button>
        ${opts.resettable ? `<button class="link small-link" data-action="reset-day" data-w="${key}">${tr('Use plan for this day')}</button>` : ''}</div>
    </section>`;
}
const datalists = () => `<datalist id="ex-list">${EXERCISES.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>
  <datalist id="cardio-list">${CARDIO.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>`;

function viewTrain() {
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  const end = days[6];
  let planned = 0, done = 0, volume = 0;
  const cards = days.map(dt => {
    const d = ymd(dt), { w, fromPlan } = workoutFor(d);
    (w.exercises || []).forEach(e => { planned++; if (e.done) { done++; volume += (+e.weight || 0) * (+e.sets || 0) * (+e.reps || 0); } });
    const resettable = !fromPlan && !!get(`workout_${d}`) && !!planCopy(d);
    return dayCard(d, dt.toLocaleDateString(LOC(), { weekday: 'long' }), dt.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }), w, { isToday: d === today(), fromPlan, resettable });
  }).join('');
  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="week" data-dir="-1" aria-label="${tr('Previous week')}">‹</button>
    <h1>${S.week.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })}</h1>
    <button class="icon-btn" data-action="week" data-dir="1" aria-label="${tr('Next week')}">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${done}<small>/${planned}</small></span><span class="muted">${tr('exercises done')}</span></div>
    <div><span class="figure">${Math.round(volume).toLocaleString(LOC())}</span><span class="muted">${tr('kg moved')}</span></div>
    <a class="btn primary" href="#plan">${tr(hasPlan() ? 'Weekly plan' : 'Set up weekly plan')}</a>
  </div>
  ${!hasPlan() ? `<p class="note hint">${tr('Tip: set up a weekly plan once, and every week fills itself in automatically.')} <button class="link" data-action="copy-week">${tr('Or copy last week')}</button></p>` : ''}
  <div class="days">${cards}</div>
  ${datalists()}`;
}

function viewPlan() {
  const p = planData();
  const ref = mondayOf(new Date());
  const cards = [...Array(7)].map((_, i) => {
    const day = p?.days?.[i] || { groups: [], exercises: [], cardio: [] };
    const dt = addDays(ref, i);
    return dayCard(`plan-${i}`, dt.toLocaleDateString(LOC(), { weekday: 'long' }), dayHasContent(day) ? '' : tr('Rest day'), day);
  }).join('');
  return `
  <header class="page-head with-nav">
    <a class="icon-btn" href="#train" aria-label="${tr('Back to training')}">‹</a>
    <h1>${tr('Weekly plan')}</h1>
  </header>
  <p class="note plan-intro">${tr('Your standard week. Every week fills itself in from this plan. If you change something on a specific day, only that day changes.')}</p>
  <div class="row plan-actions"><button class="btn" data-action="plan-from-week">${tr('Use this week as my plan')}</button>${hasPlan() ? `<button class="btn danger" data-action="plan-clear">${tr('Delete plan')}</button>` : ''}</div>
  <div class="days">${cards}</div>
  ${datalists()}`;
}

/* ---------- monthly review ---------- */
function monthReview(y, m) {
  const ms = monthStats(y, m), t = today(), hs = habits();
  const past = ms.days.filter(x => !x.future);
  const per = hs.map(h => {
    let done = 0, total = 0, run = 0, best = 0;
    past.forEach(x => { if (!activeOn(h, x.d)) return; total++; if (isDone(h.id, x.d)) { done++; run++; best = Math.max(best, run); } else run = 0; });
    return { h, done, total, best };
  }).filter(p => p.total);
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
  return { ms, per, weeks, workouts, kg, exDone, tasksDone, goals, weekly };
}
const monthTitle = (y, m) => new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });

function viewMonth() {
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
      return `<td><span class="mc ${x.future ? 'fut' : lvl(x.total ? x.pct : null)}" title="${x.future ? '' : pct(x.pct)}">${parse(d).getDate()}</span></td>`;
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
    <div><span class="figure">${pct(r.ms.pct)}</span><span class="muted">${tr('habits completed')}</span></div>
    <div><span class="figure">${r.ms.perfect}</span><span class="muted">${tr('perfect days')}</span></div>
    <div><span class="figure">${r.ms.done}</span><span class="muted">${tr('check-ins')}</span></div>
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
    <section class="panel">
      <h2>${tr('Habits this month')}</h2>
      ${r.per.length ? `<ul class="year-habits">${[...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => `<li>
        <span class="label">${esc(areaInfo(p.h.data.area).icon)} ${esc(p.h.data.name)}</span><span class="num">${pct(p.done / p.total)}</span>
        ${meter(p.done / p.total, p.h.data.name)}
        <span class="muted">${tr('{n} check-ins · best streak {b} days', { n: p.done, b: p.best })}</span></li>`).join('')}</ul>` : `<p class="note">${tr('No habit data for this month yet.')}</p>`}
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
  </div>`;
}

/* ---------- reviews list + PDF ---------- */
function reviewPeriods() {
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
function reviewsSection() {
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
const pdfLabels = () => ({ weeks: tr('Weeks'), calendar: tr('Every day'), habits: tr('Habits'), goals: tr('Goals'), none: tr('none'), all: tr('all habits') });
const pdfFooter = () => `${tr('Habit & Life Tracker')} · ${tr('created {date}', { date: new Date().toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric' }) })}`;
function monthPdfData(key) {
  const [y, mm] = key.split('-').map(Number), m = mm - 1, r = monthReview(y, m);
  const best = [...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total)[0];
  const bestWeek = r.weeks.filter(w => w.pct != null).sort((a2, b2) => b2.pct - a2.pct)[0];
  const longest = [...r.per].sort((a2, b2) => b2.best - a2.best)[0];
  const wdNames = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'short' }));
  return {
    kicker: tr('Monthly review'), title: monthTitle(y, m), filename: `${tr('Review')}-${key}.pdf`, footer: pdfFooter(), labels: pdfLabels(),
    stats: [[tr('habits completed'), pct(r.ms.pct)], [tr('perfect days'), String(r.ms.perfect)], [tr('check-ins'), String(r.ms.done)], [tr('workouts'), String(r.workouts)]],
    highlights: [best && [tr('Most consistent'), best.h.data.name, pct(best.done / best.total)], bestWeek && [tr('Best week'), cwLabel(bestWeek.key), pct(bestWeek.pct)],
      longest && longest.best && [tr('Longest streak'), longest.h.data.name, tr('{n} days', { n: longest.best })]].filter(Boolean),
    weeks: r.weeks.map(w => ({ label: cwLabel(w.key), range: `${fmtShort(w.days[0])} – ${fmtShort(w.days[w.days.length - 1])}`, pct: w.pct, color: weekNum(w.key) % 6 })),
    heat: { type: 'month', weekdays: wdNames, rows: r.weeks.map(w => {
      const first = weekdayIdx(w.days[0]);
      return { label: cwLabel(w.key), color: weekNum(w.key) % 6, cells: [...Array(7)].map((_, i) => { const d = w.days[i - first]; if (!d) return null; const x = r.ms.days.find(z => z.d === d); return { day: parse(d).getDate(), pct: x.total ? x.pct : null, future: x.future }; }) };
    }) },
    habits: [...r.per].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => ({ name: `${p.h.data.name}`, pct: p.done / p.total, detail: tr('{n} check-ins · best streak {b} days', { n: p.done, b: p.best }) })),
    lists: [
      { title: tr('Weekly habits'), items: r.weekly.map(w => [w.name, `${w.n} / ${w.of}`]) },
      { title: tr('Training and tasks'), items: [[tr('Workouts'), String(r.workouts)], [tr('Exercises done'), String(r.exDone)], [tr('kg moved'), Math.round(r.kg).toLocaleString(LOC())], [tr('Tasks completed'), String(r.tasksDone)]] },
    ],
    goals: r.goals.map(g => ({ title: g.data.title, done: !!g.data.done })),
  };
}
function yearPdfData(Y) {
  const y = +Y, ys = yearStats(y);
  const withData = ys.per.filter(p => p.total);
  const best = [...withData].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total)[0];
  const bestMonth = ys.months.filter(m2 => m2.pct != null).sort((a2, b2) => b2.pct - a2.pct)[0];
  const longest = [...withData].sort((a2, b2) => b2.best - a2.best)[0];
  const mName = (m2, f = 'short') => new Date(y, m2, 1).toLocaleDateString(LOC(), { month: f });
  return {
    kicker: tr('Year in review'), title: tr('Your year {y}', { y }), filename: `${tr('Review')}-${y}.pdf`, footer: pdfFooter(), labels: pdfLabels(),
    stats: [[tr('habits completed'), pct(ys.pct)], [tr('perfect days'), String(ys.perfect)], [tr('check-ins'), ys.done.toLocaleString(LOC())], [tr('workouts'), String(ys.workouts)]],
    highlights: [best && [tr('Most consistent'), best.h.data.name, pct(best.done / best.total)], bestMonth && [tr('Best month'), mName(bestMonth.m, 'long'), pct(bestMonth.pct)],
      longest && longest.best && [tr('Longest streak'), longest.h.data.name, tr('{n} days', { n: longest.best })]].filter(Boolean),
    heat: { type: 'year', rows: ys.months.map(mo => ({ label: mName(mo.m), end: mo.pct == null ? '' : pct(mo.pct), cells: [...Array(31)].map((_, i) => { const x = mo.days[i]; return x ? { pct: x.future ? null : x.pct, future: !!x.future } : null; }) })) },
    habits: [...withData].sort((a2, b2) => b2.done / b2.total - a2.done / a2.total).map(p => ({ name: p.h.data.name, pct: p.done / p.total, detail: tr('{n} check-ins · best streak {b} days', { n: p.done, b: p.best }) })),
    lists: [
      { title: tr('Workouts per month'), items: ys.wmonths.map((n2, m2) => [mName(m2, 'long'), String(n2)]).filter(([, v]) => v !== '0') },
      { title: tr('Training and tasks'), items: [[tr('Workouts'), String(ys.workouts)], [tr('kg moved'), Math.round(ys.kg).toLocaleString(LOC())], [tr('Tasks completed'), String(ys.tasksDone)], [tr('Goals reached'), `${ys.goalsDone} / ${ys.goals}`]] },
    ],
    goals: [],
  };
}

/* ---------- year overview ---------- */
function yearStats(y) {
  const t = today(), hs = habits();
  const months = [];
  let done = 0, total = 0, perfect = 0;
  const per = new Map(hs.map(h => [h.id, { h, done: 0, total: 0, best: 0, run: 0 }]));
  for (let m = 0; m < 12; m++) {
    const n = daysInMonth(y, m), days = [];
    let md = 0, mt = 0;
    for (let i = 1; i <= n; i++) {
      const d = `${y}-${pad(m + 1)}-${pad(i)}`;
      if (d > t) { days.push({ d, future: true }); continue; }
      let dd = 0, tt = 0;
      for (const h of hs) {
        const p = per.get(h.id);
        if (!activeOn(h, d)) continue;
        tt++; p.total++;
        if (isDone(h.id, d)) { dd++; p.done++; p.run++; p.best = Math.max(p.best, p.run); } else p.run = 0;
      }
      days.push({ d, pct: tt ? dd / tt : null });
      md += dd; mt += tt;
      if (tt && dd === tt) perfect++;
    }
    done += md; total += mt;
    months.push({ m, days, pct: mt ? md / mt : null });
  }
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
  return { months, done, total, perfect, pct: total ? done / total : 0, per: [...per.values()], wmonths, workouts, kg, tasksDone, goals: goals.length, goalsDone: goals.filter(g => g.data.done).length };
}

function viewYear() {
  const y = S.year, ys = yearStats(y);
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
    <div><span class="figure">${pct(ys.pct)}</span><span class="muted">${tr('habits completed')}</span></div>
    <div><span class="figure">${ys.perfect}</span><span class="muted">${tr('perfect days')}</span></div>
    <div><span class="figure">${ys.done.toLocaleString(LOC())}</span><span class="muted">${tr('check-ins')}</span></div>
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
        <span class="label">${esc(areaInfo(p.h.data.area).icon)} ${esc(p.h.data.name)}</span><span class="num">${pct(p.done / p.total)}</span>
        ${meter(p.done / p.total, p.h.data.name)}
        <span class="muted">${tr('{n} check-ins · best streak {b} days', { n: p.done, b: p.best })}</span></li>`).join('')}</ul>` : `<p class="note">${tr('No habit data for this year yet.')}</p>`}
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

function syncLine() {
  const st = sync.status, pend = [...S.recs.values()].filter(r => !r.synced).length;
  const map = { syncing: tr('Syncing…'), offline: tr('Offline. Changes sync when you are back online.'), error: tr('Sync failed: {msg}', { msg: esc(st.error || '') }), idle: st.last ? tr('Synced {ago}', { ago: agoText(st.last) }) : tr('Ready to sync') };
  return `${map[st.state] || ''}${pend && st.state !== 'syncing' ? ' ' + tr(pend === 1 ? '{n} change waiting.' : '{n} changes waiting.', { n: pend }) : ''}`;
}
function accountSection() {
  const st = sync.status;
  if (st.state === 'unavailable') return `<section class="panel"><h2>${tr("Sync")}</h2><p class="note">${tr("Sync needs an internet connection the first time the app opens. Reopen the app while online.")}</p></section>`;
  if (!st.user) return `<section class="panel"><h2>${tr("Sync")}</h2>
    <p class="note">${tr("Sign in to keep your phone and laptop in sync. Use the same account on every device.")}</p>
    <form class="auth" data-form="auth">
      <label>${tr("Email")}<input name="email" type="email" autocomplete="email" required></label>
      <label>${tr("Password")}<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
      <div class="row"><button class="btn primary">${tr("Sign in")}</button><button type="button" class="btn" data-action="sign-up">${tr("Create account")}</button></div>
      <button type="button" class="link forgot" data-action="forgot">${tr("Forgot password?")}</button>
    </form></section>`;
  return `<section class="panel"><h2>${tr("Sync")}</h2>
    <p>${tr("Signed in as")} <strong>${esc(st.user.email)}</strong></p>
    <p class="note">${syncLine()}</p>
    <div class="row"><button class="btn" data-action="sync-now">${tr("Sync now")}</button><button class="btn" data-action="change-password">${tr("Change password")}</button><button class="btn" data-action="sign-out">${tr("Sign out")}</button></div></section>`;
}
const NOTIFY_DEFAULTS = { enabled: false, tz: 'Europe/Berlin', morning: { on: true, time: '07:30' }, training: { on: true, time: '17:00' }, evening: { on: true, time: '20:00' } };
const notifySettings = () => ({ ...NOTIFY_DEFAULTS, ...(get('setting_notifications')?.data || {}) });
async function saveNotify(patch) {
  const cur = notifySettings();
  await save('setting', 'setting_notifications', { ...cur, ...patch, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || cur.tz });
}
async function refreshPush() {
  S.push.perm = push.permission();
  try { S.push.sub = !!(await push.currentSubscription()); } catch { S.push.sub = false; }
  if (S.view === 'more') softRender();
}
function notifySection() {
  if (!sync.status.user) return `<section class="panel"><h2>${tr("Notifications")}</h2><p class="note">${tr("Sign in to sync first. Reminders are sent from the server, so they need your account.")}</p></section>`;
  const n = notifySettings(), P = S.push;
  let state, button;
  if (!push.supported()) {
    state = push.isIOS() && !push.isStandalone()
      ? tr('To get notifications on iPad or iPhone, add the app to your Home Screen with Safari (Share > Add to Home Screen) and open it from there.')
      : tr('This browser can\'t show notifications.');
    button = '';
  } else if (P.perm === 'denied') {
    state = tr('Notifications are blocked for this app. Allow them in your device or browser settings, then come back here.');
    button = '';
  } else if (P.sub) {
    state = tr('On for this device.');
    button = `<button class="btn" data-action="push-off" ${P.busy ? 'disabled' : ''}>${tr("Turn off on this device")}</button>`;
  } else {
    state = tr('Off on this device.');
    button = `<button class="btn primary" data-action="push-on" ${P.busy ? 'disabled' : ''}>${tr(P.busy ? 'Turning on…' : 'Turn on notifications')}</button>`;
  }
  const row = (k, label, hint) => `<li class="notify-row">
      <label class="switch"><input type="checkbox" data-notif="${k}" data-nk="on" ${n[k].on ? 'checked' : ''}><span>${tr(label)}<small>${tr(hint)}</small></span></label>
      <input type="time" value="${esc(n[k].time)}" data-notif="${k}" data-nk="time" aria-label="${tr(label)}"></li>`;
  return `<section class="panel"><h2>${tr("Notifications")}</h2>
    <p class="note">${state}</p>
    <div class="row">${button}${P.sub ? `<button class="btn" data-action="push-test">${tr("Send a test")}</button>` : ''}</div>
    ${n.enabled ? `<ul class="notify-list">
      ${row('morning', 'Morning overview', 'Habits, tasks due and today\'s workout')}
      ${row('training', 'Training reminder', 'Nudge to stick to your plan or get moving')}
      ${row('evening', 'Evening check-in', 'Which habits are still open')}
    </ul>
    <p class="note">${tr("These times apply to all your devices. You can also mute the app anytime in your phone's notification settings.")}</p>` : ''}
  </section>`;
}

function viewMore() {
  let theme = 'system';
  try { theme = localStorage.getItem('theme') || 'system'; } catch {}
  const count = [...S.recs.values()].filter(r => !r.deleted).length;
  return `
  <header class="page-head"><h1>${tr("Settings")}</h1></header>
  ${db.isMemoryOnly() ? `<p class="warn">${tr("This browser blocked local storage, so changes are lost when you close the app. Open it in a normal (not private) window.")}</p>` : ''}
  <section class="panel">
    <h2>${tr("Appearance")}</h2>
    <div class="seg" role="radiogroup" aria-label="${tr("Theme")}">${['system', 'light', 'dark'].map(v => `<button role="radio" aria-checked="${v === theme}" data-action="theme" data-v="${v}">${tr(v[0].toUpperCase() + v.slice(1))}</button>`).join('')}</div>
    <h2 class="sub-h">${tr('Language')}</h2>
    <div class="seg" role="radiogroup" aria-label="${tr('Language')}">${[['en', 'English'], ['de', 'Deutsch']].map(([v, l]) => `<button role="radio" aria-checked="${v === getLang()}" data-action="lang" data-v="${v}">${l}</button>`).join('')}</div>
  </section>
  ${accountSection()}
  ${notifySection()}
  ${reviewsSection()}
  <section class="panel">
    <h2>${tr("Your data")}</h2>
    <p class="note">${tr('{n} items stored on this device.', { n: count })}</p>
    <div class="row">
      <button class="btn" data-action="export">${tr("Export backup")}</button>
      <label class="btn">${tr("Import backup")}<input type="file" accept="application/json" id="import-file" hidden></label>
      <button class="btn danger" data-action="erase">${tr("Erase everything")}</button>
    </div>
  </section>
  ${S.installPrompt ? `<section class="panel"><h2>${tr("Install")}</h2><p class="note">${tr("Add the app to your home screen or dock.")}</p><button class="btn primary" data-action="install">${tr("Install app")}</button></section>` : ''}`;
}

/* ---------- render ---------- */
function render() {
  const main = $('#main');
  const scroll = window.scrollY;
  const keepScroll = render.lastView === S.view;
  const views = { today: viewToday, habits: viewHabits, tasks: viewTasks, train: viewTrain, more: viewMore, plan: viewPlan, year: viewYear, month: viewMonth };
  const gridScroll = keepScroll ? [...document.querySelectorAll('.grid-scroll')].map(g => g.scrollLeft) : [];
  main.innerHTML = views[S.view]();
  document.querySelectorAll('.grid-scroll').forEach((g, i) => { if (gridScroll[i] != null) g.scrollLeft = gridScroll[i]; });
  const navView = { plan: 'train', year: 'habits', month: 'habits' }[S.view] || S.view;
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === navView ? 'page' : 'false'));
  if (keepScroll) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  if (S.view === 'habits' && (!keepScroll || render.lastMonth !== monthKey(S.month))) { // show today in the grid
    const g = $('.habit-grid .is-today'), box = $('.grid-scroll');
    if (box) {
      const nameW = $('.habit-grid .hname')?.offsetWidth || 0;
      box.scrollLeft = g ? Math.max(0, g.offsetLeft - nameW - (box.clientWidth - nameW) * 0.6) : 0;
    }
  }
  render.lastMonth = monthKey(S.month);
  if (S.view === 'train' && !keepScroll) $('.day.is-today')?.scrollIntoView({ block: 'start' });
  render.lastView = S.view;
}

/* ---------- forms in modal ---------- */
function habitForm(h, preset) {
  openModal(`<form data-form="habit" data-id="${h ? h.id : ''}">
    <h2>${tr(h ? 'Edit habit' : 'New habit')}</h2>
    <label>${tr("Name")}<input name="name" required value="${esc(preset?.name ?? h?.data.name ?? '')}" placeholder="${tr("e.g. Drink 2 L of water")}"></label>
    <label>${tr("Area")}<select name="area">${areaOptions(preset?.area ?? h?.data.area ?? (allAreas()[0]?.id || ''))}</select></label>
    <button type="button" class="link small-link" data-action="new-area" data-from="habit">${tr('+ New area')}</button>
    ${h ? `<p class="note">${tr('Best streak: {best} days. Current: {cur} days.', { best: bestStreak(h.id), cur: streak(h.id) })}</p>` : ''}
    <div class="row end">${h ? `<button type="button" class="btn danger" data-action="del-habit" data-id="${h.id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
function simpleForm(form, title, field, value, id, delAction) {
  openModal(`<form data-form="${form}" data-id="${id || ''}">
    <h2>${tr(title)}</h2>
    <label>${tr(field)}<input name="name" required value="${esc(value || '')}"></label>
    <div class="row end">${id && delAction ? `<button type="button" class="btn danger" data-action="${delAction}" data-id="${id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
function taskForm(x, due) {
  startAtt(x);
  openModal(`<form data-form="task" data-id="${x ? x.id : ''}">
    <h2>${tr(x ? 'Edit task' : 'New task')}</h2>
    <label>${tr("Task")}<input name="title" required value="${esc(x?.data.title || '')}"></label>
    <label>${tr("Due date")}<input type="date" name="due" value="${esc(x?.data.due ?? due ?? '')}"></label>
    <label>${tr("Project")}<select name="projectId">${projectOptions(x?.data.projectId)}</select></label>
    <label>${tr("Notes")}<textarea name="notes" rows="3">${esc(x?.data.notes || '')}</textarea></label>
    ${attSection()}
    <div class="row end">${x ? `<button type="button" class="btn danger" data-action="del-task" data-id="${x.id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
function projectForm(p) {
  startAtt(p);
  openModal(`<form data-form="project" data-id="${p ? p.id : ''}">
    <h2>${tr(p ? 'Edit project' : 'New project')}</h2>
    <label>${tr("Name")}<input name="name" required value="${esc(p?.data.name || '')}"></label>
    <label>${tr("Deadline")}<input type="date" name="deadline" value="${esc(p?.data.deadline || '')}"></label>
    ${attSection()}
    <div class="row end">${p ? `<button type="button" class="btn danger" data-action="del-project" data-id="${p.id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}

/* ---------- links & documents in task/project forms ---------- */
// While a form is open, its links and documents live in S.att and are saved together with the form.
// Files uploaded but then cancelled are removed again, and removed files are deleted on save.
function startAtt(rec) {
  S.att = { ownerId: rec?.id || uid(), list: structuredClone(rec?.data.attachments || []), added: [], removed: [], saved: false };
}
function attItems() {
  if (!S.att?.list.length) return `<li class="att-empty muted">${tr('Nothing attached yet.')}</li>`;
  return S.att.list.map((a2, i) => `<li>
    <button type="button" class="att-open" data-action="att-open" data-i="${i}">
      <span class="ico" aria-hidden="true">${a2.type === 'link' ? '🔗' : att.fileIcon(a2)}</span>
      <span class="att-text"><span class="label">${esc(a2.title)}</span><small class="muted">${a2.type === 'link' ? esc(new URL(a2.url).hostname.replace(/^www\./, '')) : att.sizeText(a2.size)}</small></span>
    </button>
    <button type="button" class="icon-btn quiet" data-action="att-del" data-i="${i}" aria-label="${tr('Remove')}">×</button></li>`).join('');
}
function attSection() {
  const files = att.canUpload();
  return `<fieldset class="att">
    <legend>${tr('Links & documents')}</legend>
    <ul id="att-list">${attItems()}</ul>
    <div class="att-link">
      <input id="att-url" type="url" inputmode="url" autocomplete="off" placeholder="${tr('Paste a link…')}" aria-label="${tr('Link')}">
      <input id="att-title" autocomplete="off" placeholder="${tr('Title (optional)')}" aria-label="${tr('Title (optional)')}">
      <button type="button" class="btn small" data-action="att-add-link">${tr('Add link')}</button>
    </div>
    ${files ? `<label class="btn small att-file">📎 ${tr('Add document')}<input type="file" id="att-file" multiple hidden></label>
      <p class="note">${tr('Up to 20 MB per file. Adding and opening documents needs internet.')}</p>`
    : `<p class="note">${tr('Sign in to sync to attach documents. Links work without an account.')}</p>`}
  </fieldset>`;
}
const refreshAtt = () => { const el = $('#att-list'); if (el) el.innerHTML = attItems(); };
async function attUpload(files) {
  for (const f of files) {
    toast(tr('Uploading {name}…', { name: f.name }));
    try { const a2 = await att.upload(S.att.ownerId, f); S.att.list.push(a2); S.att.added.push(a2); refreshAtt(); toast('Document added'); }
    catch (e) { toast(e.message); }
  }
}
function finishAtt() { // called when a form is saved
  if (!S.att) return null;
  S.att.saved = true;
  att.removeFiles(S.att.removed.map(a2 => a2.path));
  const list = S.att.list;
  return list;
}

function areasModal() {
  const areas = allAreas(), hs = habits();
  const hidden = Object.keys(BUILTIN_AREAS).some(k => get('area_' + k));
  openModal(`<div class="areas-modal">
    <h2>${tr('Areas')}</h2>
    <p class="note">${tr('Areas group your habits. Rename the built-in ones, delete what you don\'t need, or add your own.')}</p>
    <ul class="area-manage">${areas.map(a => {
      const n = hs.filter(h => h.data.area === a.id).length;
      return `<li><button data-action="edit-area" data-id="${a.id}"><span class="ico">${esc(a.icon)}</span><span class="label">${esc(a.label)}</span><span class="muted">${tr(n === 1 ? '{n} habit' : '{n} habits', { n })}</span></button></li>`;
    }).join('')}</ul>
    ${hidden ? `<button class="link small-link" data-action="restore-areas">${tr('Restore built-in areas')}</button>` : ''}
    <div class="row end"><button class="btn" data-action="close">${tr('Close')}</button><button class="btn primary" data-action="new-area">${tr('Add area')}</button></div></div>`);
}
function areaForm(a) {
  openModal(`<form data-form="area" data-id="${a ? a.id : ''}">
    <h2>${tr(a ? 'Edit area' : 'New area')}</h2>
    <div class="area-fields">
      <label class="icon-field">${tr('Icon')}<input name="icon" maxlength="8" value="${esc(a?.icon || '')}" placeholder="🏷️"></label>
      <label>${tr('Name')}<input name="name" required maxlength="40" value="${esc(a?.label || '')}" placeholder="${tr('e.g. Music')}"></label>
    </div>
    <div class="emoji-row" aria-label="${tr('Pick an icon')}">${AREA_EMOJIS.map(e => `<button type="button" data-action="pick-emoji" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="row end">${a ? `<button type="button" class="btn danger" data-action="del-area" data-id="${a.id}">${tr('Delete')}</button>` : ''}
      <button type="button" class="btn" data-action="${S.pendingHabit ? 'back-habit' : 'areas'}">${tr('Cancel')}</button><button class="btn primary">${tr('Save')}</button></div></form>`);
}

/* ---------- workout data edits ---------- */
async function editWorkout(d, fn) {
  if (d.startsWith('plan-')) { // edit the weekly plan
    const i = +d.slice(5);
    const p = structuredClone(planData() || {});
    p.days ||= {}; p.since ||= ymd(mondayOf(new Date()));
    const day = p.days[i] || {};
    day.groups ||= []; day.exercises ||= []; day.cardio ||= [];
    fn(day);
    p.days[i] = day;
    await save('setting', PLAN_ID, p);
    return;
  }
  const cur = get(`workout_${d}`)?.data || planCopy(d) || { date: d, groups: [], exercises: [], cardio: [] };
  const next = structuredClone(cur);
  delete next.fromPlan;
  next.date = d; next.groups ||= []; next.exercises ||= []; next.cardio ||= [];
  fn(next);
  await save('workout', `workout_${d}`, next);
}

/* ---------- actions ---------- */
const nextOrder = kind => Math.max(0, ...list(kind).map(r => r.data.order ?? 0)) + 1;

const actions = {
  async toggle({ h, d }) {
    const hab = get(h);
    if (hab && hab.data.start && d < hab.data.start) await save('habit', h, { ...hab.data, start: d });
    await save('habit_log', logId(h, d), { habitId: h, date: d, done: !isDone(h, d) });
    render();
  },
  'new-habit': () => habitForm(null),
  'edit-habit': ({ id }) => habitForm(get(id)),
  async 'del-habit'({ id }) {
    if (!confirm(tr("Delete this habit and its history?"))) return;
    await remove(id);
    for (const l of list('habit_log').filter(r => r.data.habitId === id)) await remove(l.id);
    closeModal(); render(); toast('Habit deleted');
  },
  async starter() {
    let o = nextOrder('habit');
    for (const [name, area] of STARTER) await save('habit', uid(), { name: tr(name), area, order: o++, start: today() });
    render(); toast('Starter habits added');
  },
  async 'starter-weekly'() {
    let o = nextOrder('weekly_habit');
    for (const name of STARTER_WEEKLY) await save('weekly_habit', uid(), { name: tr(name), order: o++, weeks: {} });
    render();
  },
  month({ dir }) { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + +dir, 1); render(); },
  week({ dir }) { S.week = addDays(S.week, 7 * +dir); render(); },
  'new-weekly': () => simpleForm('weekly', 'New weekly habit', 'Name'),
  'edit-weekly': ({ id }) => simpleForm('weekly', 'Edit weekly habit', 'Name', get(id).data.name, id, 'del-weekly'),
  async 'del-weekly'({ id }) { await remove(id); closeModal(); render(); },
  async 'toggle-week'({ id, w }) {
    const r = get(id), weeks = { ...(r.data.weeks || {}) };
    if (weeks[w]) delete weeks[w]; else weeks[w] = true;
    await save('weekly_habit', id, { ...r.data, weeks });
    render();
  },
  'new-goal': () => simpleForm('goal', tr('New goal for {month}', { month: S.month.toLocaleDateString(LOC(), { month: 'long' }) }), 'Goal'),
  async 'toggle-goal'({ id }) { const g = get(id); await save('goal', id, { ...g.data, done: !g.data.done }); render(); },
  async 'del-goal'({ id }) { await remove(id); render(); },
  'task-tab': ({ tab }) => { S.taskTab = tab; render(); },
  'new-task': ({ due }) => taskForm(null, due),
  'edit-task': ({ id }) => taskForm(get(id)),
  async 'toggle-task'({ id }) { const x = get(id); await save('task', id, { ...x.data, done: !x.data.done, doneAt: x.data.done ? '' : today() }); render(); if (!x.data.done) toast('Task done'); },
  async 'del-task'({ id }) {
    const files = [...(get(id)?.data.attachments || []), ...(S.att?.added || [])].filter(a2 => a2.type === 'file').map(a2 => a2.path);
    if (S.att) S.att.saved = true;
    await remove(id); att.removeFiles(files); closeModal(); render(); toast('Task deleted');
  },
  'new-project': () => projectForm(null),
  'edit-project': ({ id }) => projectForm(get(id)),
  async 'del-project'({ id }) {
    if (!confirm(tr("Delete this project? Its tasks stay, without a project."))) return;
    const files = [...(get(id)?.data.attachments || []), ...(S.att?.added || [])].filter(a2 => a2.type === 'file').map(a2 => a2.path);
    if (S.att) S.att.saved = true;
    await remove(id); att.removeFiles(files);
    for (const t of list('task').filter(x => x.data.projectId === id)) await save('task', t.id, { ...t.data, projectId: '' });
    closeModal(); render();
  },
  async 'add-row'({ w, list: l }) {
    await editWorkout(w, x => x[l].push(l === 'cardio' ? { name: '', time: '', speed: '', distance: '', done: false } : { name: '', weight: '', sets: 3, reps: 10, rest: tr('1 min'), done: false }));
    render();
    const inputs = document.querySelectorAll(`input[data-w="${w}"][data-list="${l}"][data-k="name"]`);
    inputs[inputs.length - 1]?.focus();
  },
  async 'del-row'({ w, list: l, i }) { await editWorkout(w, x => x[l].splice(+i, 1)); render(); },
  async 'copy-week'() {
    const prev = addDays(S.week, -7);
    let copied = 0;
    for (let i = 0; i < 7; i++) {
      const src = workoutFor(ymd(addDays(prev, i))).w;
      if (!dayHasContent(src)) continue;
      if (!src) continue;
      const d = ymd(addDays(S.week, i));
      if (get(`workout_${d}`)?.data?.exercises?.length) continue; // don't overwrite
      await save('workout', `workout_${d}`, {
        date: d, groups: [...(src.groups || [])],
        exercises: (src.exercises || []).map(e => ({ ...e, done: false })),
        cardio: (src.cardio || []).map(e => ({ ...e, done: false })),
      });
      copied++;
    }
    render(); toast(copied ? tr(copied === 1 ? 'Copied {n} day' : 'Copied {n} days', { n: copied }) : 'Nothing to copy from last week');
  },
  theme({ v }) { try { localStorage.setItem('theme', v); } catch {} applyTheme(); render(); },
  export() {
    const blob = new Blob([JSON.stringify({ app: 'habit-life-os', version: 1, exported: new Date().toISOString(), records: [...S.recs.values()] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habit-life-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async erase() {
    if (!confirm(tr("Erase all habits, tasks and workouts on this device? Export a backup first if you want to keep them."))) return;
    await db.clearAll(); S.recs.clear(); render(); toast('Everything erased');
  },
  async install() { if (!S.installPrompt) return; S.installPrompt.prompt(); await S.installPrompt.userChoice; S.installPrompt = null; render(); },
  close: () => closeModal(),
  async lang({ v }) {
    applyLang(v);
    await save('setting', 'setting_prefs', { ...(get('setting_prefs')?.data || {}), lang: v });
    render();
  },
  areas: () => areasModal(),
  'open-month'({ m }) { S.reviewMonth = m || monthKey(new Date()); location.hash = '#month'; if (S.view === 'month') render(); },
  'review-month'({ dir }) { const [Y, M] = S.reviewMonth.split('-').map(Number); S.reviewMonth = monthKey(new Date(Y, M - 1 + +dir, 1)); render(); },
  async pdf({ kind, p }, el) {
    const label = el.textContent;
    el.disabled = true; el.textContent = tr('Creating…');
    try {
      const res = await reviewPdf(kind === 'year' ? yearPdfData(p) : monthPdfData(p));
      if (res === 'downloaded') toast('PDF saved to your downloads');
    } catch (e) { toast(e.message); }
    el.disabled = false; el.textContent = label;
  },
  'open-year'({ y }) { S.year = +y || new Date().getFullYear(); location.hash = '#year'; if (S.view === 'year') render(); },
  year({ dir }) { S.year += +dir; render(); },
  async 'reset-day'({ w }) { await remove(`workout_${w}`); render(); toast('Day reset to your plan'); },
  async 'plan-from-week'() {
    const days = {};
    for (let i = 0; i < 7; i++) {
      const src = workoutFor(ymd(addDays(S.week, i))).w;
      days[i] = { groups: [...(src.groups || [])], exercises: (src.exercises || []).map(({ done, ...e }) => e), cardio: (src.cardio || []).map(({ done, ...e }) => e) };
    }
    if (hasPlan() && !confirm(tr('Replace your weekly plan with the week of {date}?', { date: S.week.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' }) }))) return;
    await save('setting', PLAN_ID, { ...(planData() || {}), days, since: planData()?.since || ymd(mondayOf(new Date())) });
    render(); toast('Weekly plan saved');
  },
  async 'plan-clear'() {
    if (!confirm(tr('Delete your weekly plan? Days you already changed stay as they are.'))) return;
    await remove(PLAN_ID); render(); toast('Weekly plan deleted');
  },
  'back-habit'() { const p = S.pendingHabit; S.pendingHabit = null; habitForm(p?.id ? get(p.id) : null, p ? { name: p.name } : null); },
  'new-area'({ from }, el) {
    if (from === 'habit') {
      const f = el.closest('form');
      S.pendingHabit = { id: f.dataset.id, name: f.querySelector('[name=name]').value };
    } else S.pendingHabit = null;
    areaForm(null);
  },
  'edit-area': ({ id }) => { S.pendingHabit = null; areaForm(areaInfo(id)); },
  'pick-emoji'({ e }, el) { const i = el.closest('form').querySelector('[name=icon]'); i.value = e; i.focus(); },
  async 'del-area'({ id }) {
    const a = areaInfo(id), n = habits().filter(h => h.data.area === id).length;
    if (!confirm(n ? tr('Delete "{name}"? Its {n} habits stay, without an area.', { name: a.label, n }) : tr('Delete "{name}"?', { name: a.label }))) return;
    for (const h of habits().filter(h => h.data.area === id)) await save('habit', h.id, { ...h.data, area: '' });
    if (BUILTIN_AREAS[id]) await save('area', 'area_' + id, { ...(get('area_' + id)?.data || {}), hidden: true, custom: false });
    else await remove(id);
    areasModal(); render();
  },
  async 'restore-areas'() {
    for (const k of Object.keys(BUILTIN_AREAS)) if (get('area_' + k)) await remove('area_' + k);
    areasModal(); render(); toast('Built-in areas restored');
  },
  async 'sign-up'(_, el) {
    const f = el.closest('form');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    try {
      const inNow = await sync.signUp(fd.get('email').trim(), fd.get('password'));
      toast(inNow ? 'Account created' : 'Check your email and confirm, then sign in here.');
    } catch (e) { toast(sync.friendly(e)); }
  },
  async 'sign-out'() {
    if (!confirm(tr("Sign out? Your data stays on this device."))) return;
    try { await push.disable(); } catch {}
    await sync.signOut(); await refreshPush(); render();
  },
  'sync-now': () => sync.syncNow(),
  forgot(_, el) {
    const email = el.closest('form')?.querySelector('[name=email]')?.value || '';
    openModal(`<form data-form="forgot">
      <h2>${tr("Reset your password")}</h2>
      <p class="note">${tr("Enter the email of your account. You'll get a link that opens the app, where you choose a new password.")}</p>
      <label>${tr("Email")}<input name="email" type="email" autocomplete="email" required value="${esc(email)}"></label>
      <div class="row end"><button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Send link")}</button></div></form>`);
  },
  'change-password': () => passwordForm(false),
  'att-add-link'() {
    const u = $('#att-url'), ti = $('#att-title');
    const link = att.makeLink(u.value, ti.value);
    if (!link) { toast('That doesn\'t look like a web address.'); u.focus(); return; }
    S.att.list.push(link); u.value = ''; ti.value = ''; refreshAtt();
  },
  async 'att-open'({ i }) {
    const a2 = S.att?.list[+i];
    if (!a2) return;
    if (a2.type === 'link') { window.open(a2.url, '_blank', 'noopener'); return; }
    try { await att.openFile(a2); } catch (e) { toast(e.message); }
  },
  'att-del'({ i }) {
    const [a2] = S.att.list.splice(+i, 1);
    if (a2?.type === 'file') {
      const k = S.att.added.indexOf(a2);
      if (k >= 0) { S.att.added.splice(k, 1); att.removeFiles([a2.path]); } else S.att.removed.push(a2);
    }
    refreshAtt();
  },
  async 'push-on'() {
    S.push.busy = true; render();
    try { await push.enable(); await saveNotify({ enabled: true }); toast('Notifications are on'); }
    catch (e) { toast(e.message); }
    S.push.busy = false; await refreshPush(); render();
  },
  async 'push-off'() {
    try { await push.disable(); toast('Turned off on this device'); } catch (e) { toast(e.message); }
    await refreshPush(); render();
  },
  async 'push-test'() {
    try { const r = await push.test(); toast(r.sent ? tr(r.sent === 1 ? 'Test sent to {n} device' : 'Test sent to {n} devices', { n: r.sent }) : 'Could not deliver the test. Try turning notifications off and on again.'); }
    catch (e) { toast(e.message); }
  },
};

const forms = {
  async area(fd, id) {
    const name = fd.get('name').trim(), icon = (fd.get('icon') || '').trim() || '🏷️';
    let areaId = id;
    if (id && BUILTIN_AREAS[id]) await save('area', 'area_' + id, { ...(get('area_' + id)?.data || {}), name, icon, custom: false, hidden: false });
    else if (id) await save('area', id, { ...get(id).data, name, icon });
    else { areaId = 'area_' + uid(); await save('area', areaId, { name, icon, custom: true, order: 100 + list('area').length }); }
    if (S.pendingHabit) { const p = S.pendingHabit; S.pendingHabit = null; habitForm(p.id ? get(p.id) : null, { name: p.name, area: areaId }); }
    else areasModal();
    toast('Area saved');
    return 'keep';
  },
  async habit(fd, id) {
    const old = id ? get(id) : null;
    await save('habit', id || uid(), { ...(old?.data || { order: nextOrder('habit'), start: today() }), name: fd.get('name').trim(), area: fd.get('area') });
  },
  async weekly(fd, id) {
    const old = id ? get(id) : null;
    await save('weekly_habit', id || uid(), { ...(old?.data || { order: nextOrder('weekly_habit'), weeks: {} }), name: fd.get('name').trim() });
  },
  async goal(fd) {
    await save('goal', uid(), { title: fd.get('name').trim(), month: monthKey(S.month), done: false, order: nextOrder('goal') });
  },
  async task(fd, id) {
    const rid = id || S.att?.ownerId || uid(), old = get(rid);
    const attachments = finishAtt() ?? old?.data.attachments ?? [];
    await save('task', rid, { ...(old?.data || { done: false }), title: fd.get('title').trim(), due: fd.get('due') || '', projectId: fd.get('projectId') || '', notes: fd.get('notes') || '', attachments });
  },
  async project(fd, id) {
    const rid = id || S.att?.ownerId || uid(), old = get(rid);
    const attachments = finishAtt() ?? old?.data.attachments ?? [];
    await save('project', rid, { ...(old?.data || {}), name: fd.get('name').trim(), deadline: fd.get('deadline') || '', attachments });
  },
  async auth(fd) {
    try { await sync.signIn(fd.get('email').trim(), fd.get('password')); }
    catch (e) { throw new Error(sync.friendly(e)); }
    toast('Signed in');
  },
  async forgot(fd) {
    const email = fd.get('email').trim();
    try { await sync.resetPassword(email); }
    catch (e) { throw new Error(sync.friendly(e)); }
    toast(tr('If {email} has an account, a reset link is on its way. Check spam too.', { email }));
  },
  async password(fd) {
    const pw = fd.get('password'), again = fd.get('again');
    if (pw !== again) throw new Error('The two passwords are not the same.');
    try { await sync.updatePassword(pw); }
    catch (e) { throw new Error(sync.friendly(e)); }
    toast('Password changed');
  },
  async 'quick-task'(fd) {
    await save('task', uid(), { title: fd.get('title').trim(), due: fd.get('due') || '', projectId: '', notes: '', done: false });
    toast('Task added');
  },
};

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  try { await fn(el.dataset, el); } catch (err) { console.error(err); toast('Something went wrong. Try again.'); }
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = forms[f.dataset.form];
  if (!fn) return;
  let res;
  try { res = await fn(new FormData(f), f.dataset.id); }
  catch (err) { toast(err.message || 'Something went wrong. Try again.'); return; }
  if (res !== 'keep' && $('#modal').open) closeModal();
  render();
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'import-file' && el.files[0]) return importFile(el.files[0]);
  if (el.id === 'att-file' && el.files.length) { const files = [...el.files]; el.value = ''; return attUpload(files); }
  if (el.dataset.notif) {
    const k = el.dataset.notif, cur = notifySettings()[k];
    await saveNotify({ [k]: { ...cur, [el.dataset.nk]: el.type === 'checkbox' ? el.checked : (el.value || cur.time) } });
    return;
  }
  const d = el.dataset.w;
  if (!d) return;
  if (el.dataset.k === 'groups') {
    await editWorkout(d, x => { x.groups = el.value.split(',').map(s => s.trim()).filter(Boolean); });
    return;
  }
  const { list: l, i, k } = el.dataset;
  await editWorkout(d, x => { if (x[l][+i]) x[l][+i][k] = el.type === 'checkbox' ? el.checked : el.value; });
  if (el.type === 'checkbox') render();
});

async function importFile(file) {
  try {
    const json = JSON.parse(await file.text());
    const recs = Array.isArray(json.records) ? json.records : [];
    const merged = [];
    for (const r of recs) {
      if (!r || !r.id || !r.kind) continue;
      const cur = S.recs.get(r.id);
      if (!cur || (r.updated_at || '') > (cur.updated_at || '')) { const rec = { ...r, synced: false }; S.recs.set(r.id, rec); merged.push(rec); }
    }
    await db.putMany(merged);
    render(); toast(tr('Imported {n} items', { n: merged.length }));
  } catch { toast('That file is not a valid backup.'); }
}

function applyLang(v) {
  let l = v || get('setting_prefs')?.data?.lang;
  if (!l) { try { l = localStorage.getItem('lang'); } catch {} }
  if (!l) l = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  setLang(l);
  try { localStorage.setItem('lang', getLang()); } catch {}
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
}

function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem('theme') || 'system'; } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function route() {
  const v = location.hash.slice(1);
  if (v === 'tasks/new') { // quick action from the app icon
    S.view = 'tasks'; S.taskTab = 'today';
    history.replaceState(null, '', '#tasks');
    render();
    setTimeout(() => $('#qt')?.focus(), 60);
    return;
  }
  S.view = VIEWS.includes(v) ? v : 'today';
  render();
  if (S.view === 'more') refreshPush();
}

window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (e.data?.type === 'open' && e.data.hash) location.hash = e.data.hash;
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; if (S.view === 'more') render(); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// re-render when the day changes while the app stays open
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); S.week = mondayOf(new Date()); render(); } }, 60000);

/* ---------- sync wiring ---------- */
const userIsEditing = () => $('#modal').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
let renderPending = false;
function softRender() { if (userIsEditing()) renderPending = true; else render(); }
document.addEventListener('focusout', () => setTimeout(() => { if (renderPending && !userIsEditing()) { renderPending = false; render(); } }, 50));
$('#modal').addEventListener('close', () => {
  if (S.att && !S.att.saved) att.removeFiles(S.att.added.map(a2 => a2.path)); // cancelled: undo new uploads
  S.att = null;
  if (renderPending) { renderPending = false; render(); }
});
document.addEventListener('keydown', e => { // Enter in the link field adds the link instead of saving the form
  if (e.key === 'Enter' && (e.target.id === 'att-url' || e.target.id === 'att-title')) { e.preventDefault(); actions['att-add-link'](); }
});

const syncHooks = {
  async applyRemote(rows) {
    const changed = [];
    for (const r of rows) {
      const cur = S.recs.get(r.id);
      if (!cur || r.updated_at > cur.updated_at) { const rec = { ...r, synced: true }; S.recs.set(r.id, rec); changed.push(rec); }
      else if (r.updated_at === cur.updated_at && !cur.synced) { cur.synced = true; changed.push(cur); }
    }
    if (changed.length) {
      await db.putMany(changed);
      if (changed.some(r => r.id === 'setting_prefs')) applyLang();
      softRender();
    }
  },
  pending: () => [...S.recs.values()].filter(r => !r.synced),
  async markSynced(rows) {
    const done = [];
    for (const r of rows) { const cur = S.recs.get(r.id); if (cur && cur.updated_at === r.updated_at) { cur.synced = true; done.push(cur); } }
    await db.putMany(done);
  },
  onStatus() {
    const dot = $('#sync-dot');
    if (dot) {
      const st = sync.status.state;
      dot.dataset.state = !sync.status.user ? 'off' : st === 'idle' && syncHooks.pending().length ? 'syncing' : st;
      dot.title = sync.status.user ? syncLine().replace(/<[^>]+>/g, '') : tr('Not signed in');
    }
    if (S.view === 'more') softRender();
  },
  onRecovery() {
    location.hash = '#more';
    passwordForm(true);
  },
  onLinkError(msg) {
    const expired = /expired|invalid/i.test(msg);
    toast(expired ? 'That link has expired. Request a new one with "Forgot password".' : msg);
  },
};

function passwordForm(fromReset) {
  openModal(`<form data-form="password">
    <h2>${tr(fromReset ? 'Choose a new password' : 'Change password')}</h2>
    ${fromReset ? `<p class="note">${tr("You're signed in through the reset link. Set a new password to finish.")}</p>` : ''}
    <label>${tr("New password")}<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>${tr("Repeat new password")}<input name="again" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="row end"><button type="button" class="btn" data-action="close">${tr(fromReset ? 'Later' : 'Cancel')}</button><button class="btn primary">${tr("Save password")}</button></div></form>`);
}

/* ---------- start ---------- */
(async function start() {
  applyTheme();
  await db.open();
  (await db.loadAll()).forEach(r => S.recs.set(r.id, r));
  applyLang();
  await migrateWeekly();
  route();
  await sync.init(syncHooks);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

import * as db from './db.js';
import * as sync from './sync.js';
import * as push from './push.js';
import { tr, setLang, getLang, LOC } from './i18n.js';

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
const VIEWS = ['today', 'habits', 'tasks', 'train', 'more'];

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
  const w = get(`workout_${t}`)?.data;

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

  const head = ms.days.map(x => `<th scope="col" class="${x.d === t ? 'is-today' : ''}"><span class="wd">${wd(x.d)}</span><span class="dn">${parse(x.d).getDate()}</span></th>`).join('');
  const bars = ms.days.map(x => `<td class="${x.d === t ? 'is-today' : ''}"><span class="bar" style="--h:${x.future ? 0 : Math.round(x.pct * 100)}%" title="${x.future ? '' : pct(x.pct)}"></span></td>`).join('');
  const rows = hs.map(h => {
    let cnt = 0;
    const cells = ms.days.map(x => {
      const done = isDone(h.id, x.d); if (done) cnt++;
      return `<td class="${x.d === t ? 'is-today' : ''}"><button class="cell ${done ? 'on' : ''}" data-action="toggle" data-h="${h.id}" data-d="${x.d}" ${x.future ? 'disabled' : ''} aria-pressed="${done}" aria-label="${esc(h.data.name)}, ${fmtShort(x.d)}"></button></td>`;
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
  const wks = Math.ceil(daysInMonth(y, m) / 7);
  const weekly = list('weekly_habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const weeklyRows = weekly.map(r => {
    const checks = r.data.checks?.[mk] || [];
    return `<tr><th scope="row" class="hname"><button data-action="edit-weekly" data-id="${r.id}">${esc(r.data.name)}</button></th>
      ${[...Array(wks)].map((_, i) => `<td><button class="cell ${checks[i] ? 'on' : ''}" data-action="toggle-week" data-id="${r.id}" data-w="${i}" aria-pressed="${!!checks[i]}" aria-label="${esc(r.data.name)}, ${tr('week {n}', { n: i + 1 })}"></button></td>`).join('')}
      <td class="hcount">${checks.filter(Boolean).length}<small>/${wks}</small></td></tr>`;
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
    <button class="btn primary" data-action="new-habit">${tr("Add habit")}</button>
  </div>
  ${hs.length ? `
  <section class="panel flush">
    <div class="grid-scroll">
      <table class="habit-grid">
        <thead>
          <tr class="bars"><th scope="row" class="hname muted">${tr("Daily")}</th>${bars}<td></td></tr>
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
      ${weekly.length ? `<div class="grid-scroll"><table class="habit-grid weekly"><thead><tr><th class="hname">${tr("Habit")}</th>${[...Array(wks)].map((_, i) => `<th scope="col"><span class="dn">${tr('W{n}', { n: i + 1 })}</span></th>`).join('')}<th class="hcount">${tr("Done")}</th></tr></thead><tbody>${weeklyRows}</tbody></table></div>`
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

function taskRow(x) {
  const t = today(), p = x.data.projectId ? get(x.data.projectId) : null;
  const over = x.data.due && x.data.due < t && !x.data.done;
  return `<li class="task ${x.data.done ? 'is-done' : ''}">
    <button class="box-btn" data-action="toggle-task" data-id="${x.id}" aria-pressed="${!!x.data.done}" aria-label="${esc(x.data.title)}: ${tr(x.data.done ? 'mark as not done' : 'mark as done')}"><span class="box" aria-hidden="true"></span></button>
    <button class="task-main" data-action="edit-task" data-id="${x.id}">
      <span class="label">${esc(x.data.title)}</span>
      <span class="meta">${p ? `<span class="chip">${esc(p.data.name)}</span>` : ''}${x.data.due ? `<span class="${over ? 'late' : 'muted'}">${over ? tr('Overdue, ') : ''}${x.data.due === t ? tr('today') : fmtShort(x.data.due)}</span>` : ''}</span>
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
      <span class="muted">${tr('{done} of {total} tasks done', { done, total: ts.length })}</span>
      ${meter(ts.length ? done / ts.length : 0, p.data.name)}
      ${left !== null ? `<span class="${left < 0 ? 'late' : 'muted'}">${left < 0 ? tr('{n} days late', { n: -left }) : left === 0 ? tr('Due today') : tr('{n} days to go', { n: left })}</span>` : ''}
    </button>`;
  }).join('')}</div>` : `<section class="panel"><p class="note">${tr("Group tasks into projects, like an exam, a trip or a side project.")}</p></section>`}`;
}

function viewTrain() {
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  const end = days[6];
  let planned = 0, done = 0, volume = 0;
  const cards = days.map(dt => {
    const d = ymd(dt), w = get(`workout_${d}`)?.data || { groups: [], exercises: [], cardio: [] };
    (w.exercises || []).forEach(e => { planned++; if (e.done) { done++; volume += (+e.weight || 0) * (+e.sets || 0) * (+e.reps || 0); } });
    const isToday = d === today();
    const exRows = (w.exercises || []).map((e, i) => `<tr>
      <td><input type="checkbox" ${e.done ? 'checked' : ''} data-w="${d}" data-list="exercises" data-i="${i}" data-k="done" aria-label="${tr("Done")}"></td>
      <td><input list="ex-list" value="${esc(e.name)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="name" aria-label="${tr("Exercise")}" placeholder="${tr("Exercise")}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.5" value="${esc(e.weight)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="weight" aria-label="${tr("Weight in kg")}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.sets)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="sets" aria-label="${tr("Sets")}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.reps)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="reps" aria-label="${tr("Reps")}"></td>
      <td><input value="${esc(e.rest)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="rest" aria-label="${tr("Rest")}" placeholder="${tr("1 min")}"></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="exercises" data-i="${i}" aria-label="${tr("Remove exercise")}">×</button></td></tr>`).join('');
    const caRows = (w.cardio || []).map((e, i) => `<tr>
      <td><input type="checkbox" ${e.done ? 'checked' : ''} data-w="${d}" data-list="cardio" data-i="${i}" data-k="done" aria-label="${tr("Done")}"></td>
      <td><input list="cardio-list" value="${esc(e.name)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="name" aria-label="${tr("Cardio")}" placeholder="${tr("Cardio")}"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.time)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="time" aria-label="${tr("Minutes")}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.speed)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="speed" aria-label="${tr("Speed km/h")}"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.distance)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="distance" aria-label="${tr("Distance km")}"></td>
      <td></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="cardio" data-i="${i}" aria-label="${tr("Remove cardio")}">×</button></td></tr>`).join('');
    const hasAny = (w.exercises || []).length || (w.cardio || []).length;
    return `<section class="panel day ${isToday ? 'is-today' : ''}">
      <div class="panel-head"><h2>${dt.toLocaleDateString(LOC(), { weekday: 'long' })} <span class="muted">${dt.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })}</span></h2></div>
      <input class="groups" value="${esc((w.groups || []).join(', '))}" data-w="${d}" data-k="groups" placeholder="${tr("Muscle groups, e.g. Chest, Triceps")}" aria-label="${tr("Muscle groups")}">
      ${hasAny ? `<div class="grid-scroll"><table class="workout">
        ${(w.exercises || []).length ? `<thead><tr><th></th><th>${tr("Exercise")}</th><th>${tr("kg")}</th><th>${tr("Sets")}</th><th>${tr("Reps")}</th><th>${tr("Rest")}</th><th></th></tr></thead><tbody>${exRows}</tbody>` : ''}
        ${(w.cardio || []).length ? `<thead><tr><th></th><th>${tr("Cardio")}</th><th>${tr("Min")}</th><th>${tr("km/h")}</th><th>${tr("km")}</th><th></th><th></th></tr></thead><tbody>${caRows}</tbody>` : ''}
      </table></div>` : ''}
      <div class="row"><button class="btn small" data-action="add-row" data-w="${d}" data-list="exercises">${tr("Add exercise")}</button><button class="btn small" data-action="add-row" data-w="${d}" data-list="cardio">${tr("Add cardio")}</button></div>
    </section>`;
  }).join('');
  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="week" data-dir="-1" aria-label="${tr("Previous week")}">‹</button>
    <h1>${S.week.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })}</h1>
    <button class="icon-btn" data-action="week" data-dir="1" aria-label="${tr("Next week")}">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${done}<small>/${planned}</small></span><span class="muted">${tr("exercises done")}</span></div>
    <div><span class="figure">${Math.round(volume).toLocaleString(LOC())}</span><span class="muted">${tr("kg moved")}</span></div>
    <button class="btn" data-action="copy-week">${tr("Copy last week")}</button>
  </div>
  <div class="days">${cards}</div>
  <datalist id="ex-list">${EXERCISES.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>
  <datalist id="cardio-list">${CARDIO.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>`;
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
  const views = { today: viewToday, habits: viewHabits, tasks: viewTasks, train: viewTrain, more: viewMore };
  const gridScroll = keepScroll ? [...document.querySelectorAll('.grid-scroll')].map(g => g.scrollLeft) : [];
  main.innerHTML = views[S.view]();
  document.querySelectorAll('.grid-scroll').forEach((g, i) => { if (gridScroll[i] != null) g.scrollLeft = gridScroll[i]; });
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === S.view ? 'page' : 'false'));
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
  openModal(`<form data-form="task" data-id="${x ? x.id : ''}">
    <h2>${tr(x ? 'Edit task' : 'New task')}</h2>
    <label>${tr("Task")}<input name="title" required value="${esc(x?.data.title || '')}"></label>
    <label>${tr("Due date")}<input type="date" name="due" value="${esc(x?.data.due ?? due ?? '')}"></label>
    <label>${tr("Project")}<select name="projectId">${projectOptions(x?.data.projectId)}</select></label>
    <label>${tr("Notes")}<textarea name="notes" rows="3">${esc(x?.data.notes || '')}</textarea></label>
    <div class="row end">${x ? `<button type="button" class="btn danger" data-action="del-task" data-id="${x.id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
function projectForm(p) {
  openModal(`<form data-form="project" data-id="${p ? p.id : ''}">
    <h2>${tr(p ? 'Edit project' : 'New project')}</h2>
    <label>${tr("Name")}<input name="name" required value="${esc(p?.data.name || '')}"></label>
    <label>${tr("Deadline")}<input type="date" name="deadline" value="${esc(p?.data.deadline || '')}"></label>
    <div class="row end">${p ? `<button type="button" class="btn danger" data-action="del-project" data-id="${p.id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
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
  const cur = get(`workout_${d}`)?.data || { date: d, groups: [], exercises: [], cardio: [] };
  const next = structuredClone(cur);
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
    for (const name of STARTER_WEEKLY) await save('weekly_habit', uid(), { name: tr(name), order: o++, checks: {} });
    render();
  },
  month({ dir }) { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + +dir, 1); render(); },
  week({ dir }) { S.week = addDays(S.week, 7 * +dir); render(); },
  'new-weekly': () => simpleForm('weekly', 'New weekly habit', 'Name'),
  'edit-weekly': ({ id }) => simpleForm('weekly', 'Edit weekly habit', 'Name', get(id).data.name, id, 'del-weekly'),
  async 'del-weekly'({ id }) { await remove(id); closeModal(); render(); },
  async 'toggle-week'({ id, w }) {
    const r = get(id), mk = monthKey(S.month);
    const checks = { ...(r.data.checks || {}) };
    const arr = [...(checks[mk] || [])];
    arr[+w] = !arr[+w]; checks[mk] = arr;
    await save('weekly_habit', id, { ...r.data, checks });
    render();
  },
  'new-goal': () => simpleForm('goal', tr('New goal for {month}', { month: S.month.toLocaleDateString(LOC(), { month: 'long' }) }), 'Goal'),
  async 'toggle-goal'({ id }) { const g = get(id); await save('goal', id, { ...g.data, done: !g.data.done }); render(); },
  async 'del-goal'({ id }) { await remove(id); render(); },
  'task-tab': ({ tab }) => { S.taskTab = tab; render(); },
  'new-task': ({ due }) => taskForm(null, due),
  'edit-task': ({ id }) => taskForm(get(id)),
  async 'toggle-task'({ id }) { const x = get(id); await save('task', id, { ...x.data, done: !x.data.done }); render(); if (!x.data.done) toast('Task done'); },
  async 'del-task'({ id }) { await remove(id); closeModal(); render(); toast('Task deleted'); },
  'new-project': () => projectForm(null),
  'edit-project': ({ id }) => projectForm(get(id)),
  async 'del-project'({ id }) {
    if (!confirm(tr("Delete this project? Its tasks stay, without a project."))) return;
    await remove(id);
    for (const t of list('task').filter(x => x.data.projectId === id)) await save('task', t.id, { ...t.data, projectId: '' });
    closeModal(); render();
  },
  async 'add-row'({ w, list: l }) {
    await editWorkout(w, x => x[l].push(l === 'cardio' ? { name: '', time: '', speed: '', distance: '', done: false } : { name: '', weight: '', sets: 3, reps: 10, rest: '1 min', done: false }));
    render();
    const inputs = document.querySelectorAll(`input[data-w="${w}"][data-list="${l}"][data-k="name"]`);
    inputs[inputs.length - 1]?.focus();
  },
  async 'del-row'({ w, list: l, i }) { await editWorkout(w, x => x[l].splice(+i, 1)); render(); },
  async 'copy-week'() {
    const prev = addDays(S.week, -7);
    let copied = 0;
    for (let i = 0; i < 7; i++) {
      const src = get(`workout_${ymd(addDays(prev, i))}`)?.data;
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
    await save('weekly_habit', id || uid(), { ...(old?.data || { order: nextOrder('weekly_habit'), checks: {} }), name: fd.get('name').trim() });
  },
  async goal(fd) {
    await save('goal', uid(), { title: fd.get('name').trim(), month: monthKey(S.month), done: false, order: nextOrder('goal') });
  },
  async task(fd, id) {
    const old = id ? get(id) : null;
    await save('task', id || uid(), { ...(old?.data || { done: false }), title: fd.get('title').trim(), due: fd.get('due') || '', projectId: fd.get('projectId') || '', notes: fd.get('notes') || '' });
  },
  async project(fd, id) {
    const old = id ? get(id) : null;
    await save('project', id || uid(), { ...(old?.data || {}), name: fd.get('name').trim(), deadline: fd.get('deadline') || '' });
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
$('#modal').addEventListener('close', () => { if (renderPending) { renderPending = false; render(); } });

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
  route();
  await sync.init(syncHooks);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

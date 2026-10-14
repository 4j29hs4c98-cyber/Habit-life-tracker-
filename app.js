import * as db from './db.js';
import * as sync from './sync.js';
import * as google from './google.js';

/* ---------- constants ---------- */
const AREAS = {
  health:       { label: 'Health',        icon: '🫀' },
  mind:         { label: 'Mind',          icon: '🧘' },
  productivity: { label: 'Productivity',  icon: '🎯' },
  lifestyle:    { label: 'Lifestyle',     icon: '🌿' },
  work:         { label: 'Work & school', icon: '📚' },
  finance:      { label: 'Finance',       icon: '💶' },
};
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
const fmtShort = s => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* ---------- state + storage ---------- */
const S = {
  recs: new Map(),
  view: 'today',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  week: mondayOf(new Date()),
  taskTab: 'today',
  installPrompt: null,
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
const areaOptions = sel => Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${a.icon} ${a.label}</option>`).join('');
const projectOptions = sel => `<option value="">No project</option>` + list('project').map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.data.name)}</option>`).join('');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
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

/* ---------- calendar + inbox ---------- */
const timeFmt = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function agoText(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtShort(ymd(new Date(iso)));
}
function googlePanels() {
  if (!google.configured() || !sync.status.user) return '';
  const accts = google.G.data?.accounts || [];
  const refreshBtn = `<button class="btn small" data-action="g-refresh" ${google.G.loading ? 'disabled' : ''}>${google.G.loading ? 'Loading…' : 'Refresh'}</button>`;
  if (!accts.length) return `<section class="panel"><div class="panel-head"><h2>Calendar</h2></div><p class="note">Connect a Google account in Settings to see your appointments and unread emails here.</p></section>`;
  const t = today();
  const evs = accts.flatMap(a => (a.events || []).map(e => ({ ...e, day: e.allDay ? e.start : ymd(new Date(e.start)) })));
  const days = {};
  evs.forEach(e => (days[e.day] ||= []).push(e));
  const keys = Object.keys(days).filter(k => k >= t).sort().slice(0, 4);
  if (!keys.includes(t)) keys.unshift(t);
  const label = k => k === t ? 'Today' : k === ymd(addDays(new Date(), 1)) ? 'Tomorrow' : parse(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const evRow = e => `<li><a class="event" href="${esc(e.link)}" target="_blank" rel="noopener" style="--c:${esc(e.color || 'var(--sage)')}">
      <span class="when">${e.allDay ? 'All day' : `${timeFmt(e.start)}<br><span class="muted">${timeFmt(e.end)}</span>`}</span>
      <span class="what"><span class="label">${esc(e.title)}</span><span class="muted">${esc(e.calendar || '')}${e.location ? `, ${esc(e.location)}` : ''}</span></span></a></li>`;
  const cal = keys.map(k => {
    const list = (days[k] || []).sort((a, b) => (b.allDay - a.allDay) || a.start.localeCompare(b.start));
    return `<h3 class="day-label">${label(k)}</h3>${list.length ? `<ul class="events">${list.map(evRow).join('')}</ul>` : `<p class="note">No appointments.</p>`}`;
  }).join('');
  const problems = accts.filter(a => a.error);
  const inbox = accts.map(a => `<li><a href="https://mail.google.com/mail/u/?authuser=${encodeURIComponent(a.email)}" target="_blank" rel="noopener">
      <span class="label">${esc(a.email)}</span>
      ${a.error ? `<span class="late">${a.error === 'reconnect' ? 'Reconnect in Settings' : 'Could not load'}</span>` : `<span class="unread ${a.unread ? 'has' : ''}">${a.unread ?? '–'}</span>`}</a></li>`).join('');
  return `
    <section class="panel">
      <div class="panel-head"><h2>Calendar</h2>${refreshBtn}</div>
      ${cal}
      <p class="note">Updated ${agoText(google.G.data?.fetched)}${google.G.error ? `. Last refresh failed: ${esc(google.G.error)}` : ''}${problems.length ? '. Some accounts need attention.' : ''}</p>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Unread email</h2></div>
      <ul class="inbox">${inbox}</ul>
    </section>`;
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
      ${s ? `<span class="streak" title="Current streak">${s} ${s === 1 ? 'day' : 'days'}</span>` : ''}</button></li>`;
  }).join('')}</ul>` : `<div class="empty"><p>No habits yet. Add your own, or start with a set of common ones you can edit.</p>
      <div class="row"><button class="btn primary" data-action="new-habit">Add a habit</button><button class="btn" data-action="starter">Use starter set</button></div></div>`;

  return `
  <header class="page-head">
    <p class="sub">${now.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
    <h1>${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</h1>
  </header>
  <div class="today-layout">
    <section class="panel span-2">
      <div class="panel-head"><h2>Habits today</h2><p class="figure">${ds.done}<small> of ${ds.total}</small></p></div>
      ${meter(ds.pct, 'Habits done today')}
      ${habitList}
    </section>
    <section class="panel">
      <h2>This month</h2>
      <dl class="stats">
        <div><dt>Completed</dt><dd>${pct(ms.pct)}</dd></div>
        <div><dt>Perfect days</dt><dd>${ms.perfect}</dd></div>
        <div><dt>Longest streak now</dt><dd>${top && top.s ? `${top.s} d` : '–'}</dd></div>
      </dl>
      ${top && top.s ? `<p class="note">${esc(top.h.data.name)} leads.</p>` : ''}
    </section>
    ${googlePanels()}
    <section class="panel">
      <div class="panel-head"><h2>Due today</h2><button class="btn small" data-action="new-task" data-due="${t}">Add task</button></div>
      ${due.length ? `<ul class="task-list">${due.map(taskRow).join('')}</ul>` : `<p class="note">Nothing due. Plan something on the Tasks tab.</p>`}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Training</h2><a class="btn small" href="#train">Open</a></div>
      ${w && (w.exercises?.length || w.cardio?.length) ? `
        <p class="lead">${esc((w.groups || []).join(', ') || 'Workout planned')}</p>
        <p class="note">${(w.exercises || []).filter(e => e.done).length} of ${(w.exercises || []).length} exercises done${w.cardio?.length ? `, ${w.cardio.length} cardio` : ''}</p>`
      : `<p class="note">Rest day, or nothing planned yet.</p>`}
    </section>
  </div>`;
}

function viewHabits() {
  const y = S.month.getFullYear(), m = S.month.getMonth(), t = today(), mk = monthKey(S.month);
  const ms = monthStats(y, m), hs = habits();
  const monthName = S.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const wd = d => 'MTWTFSS'[(parse(d).getDay() + 6) % 7];

  const head = ms.days.map(x => `<th scope="col" class="${x.d === t ? 'is-today' : ''}"><span class="wd">${wd(x.d)}</span><span class="dn">${parse(x.d).getDate()}</span></th>`).join('');
  const bars = ms.days.map(x => `<td class="${x.d === t ? 'is-today' : ''}"><span class="bar" style="--h:${x.future ? 0 : Math.round(x.pct * 100)}%" title="${x.future ? '' : pct(x.pct)}"></span></td>`).join('');
  const rows = hs.map(h => {
    let cnt = 0;
    const cells = ms.days.map(x => {
      const done = isDone(h.id, x.d); if (done) cnt++;
      return `<td class="${x.d === t ? 'is-today' : ''}"><button class="cell ${done ? 'on' : ''}" data-action="toggle" data-h="${h.id}" data-d="${x.d}" ${x.future ? 'disabled' : ''} aria-pressed="${done}" aria-label="${esc(h.data.name)} on ${fmtShort(x.d)}"></button></td>`;
    }).join('');
    return `<tr><th scope="row" class="hname"><button data-action="edit-habit" data-id="${h.id}" title="Edit habit"><span aria-hidden="true">${AREAS[h.data.area]?.icon || '•'}</span>${esc(h.data.name)}</button></th>${cells}<td class="hcount">${cnt}<small>/${ms.days.length}</small></td></tr>`;
  }).join('');

  // area breakdown for this month
  const areaRows = Object.entries(AREAS).map(([k, a]) => {
    const ah = hs.filter(h => h.data.area === k);
    if (!ah.length) return '';
    let d = 0, tot = 0;
    ms.days.filter(x => !x.future).forEach(x => ah.forEach(h => { if (activeOn(h, x.d)) { tot++; if (isDone(h.id, x.d)) d++; } }));
    return `<li><span>${a.icon} ${a.label}</span><span class="muted">${ah.length} ${ah.length === 1 ? 'habit' : 'habits'}</span>${meter(tot ? d / tot : 0, a.label)}<span class="num">${tot ? pct(d / tot) : '–'}</span></li>`;
  }).join('');

  // weekly habits
  const wks = Math.ceil(daysInMonth(y, m) / 7);
  const weekly = list('weekly_habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const weeklyRows = weekly.map(r => {
    const checks = r.data.checks?.[mk] || [];
    return `<tr><th scope="row" class="hname"><button data-action="edit-weekly" data-id="${r.id}">${esc(r.data.name)}</button></th>
      ${[...Array(wks)].map((_, i) => `<td><button class="cell ${checks[i] ? 'on' : ''}" data-action="toggle-week" data-id="${r.id}" data-w="${i}" aria-pressed="${!!checks[i]}" aria-label="${esc(r.data.name)}, week ${i + 1}"></button></td>`).join('')}
      <td class="hcount">${checks.filter(Boolean).length}<small>/${wks}</small></td></tr>`;
  }).join('');

  // goals
  const goals = list('goal').filter(g => g.data.month === mk).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const goalsDone = goals.filter(g => g.data.done).length;

  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="month" data-dir="-1" aria-label="Previous month">‹</button>
    <h1>${monthName}</h1>
    <button class="icon-btn" data-action="month" data-dir="1" aria-label="Next month">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${pct(ms.pct)}</span><span class="muted">completed</span></div>
    <div><span class="figure">${ms.perfect}</span><span class="muted">perfect days</span></div>
    <div><span class="figure">${ms.done}</span><span class="muted">check-ins</span></div>
    <button class="btn primary" data-action="new-habit">Add habit</button>
  </div>
  ${hs.length ? `
  <section class="panel flush">
    <div class="grid-scroll">
      <table class="habit-grid">
        <thead>
          <tr class="bars"><th scope="row" class="hname muted">Daily</th>${bars}<td></td></tr>
          <tr><th scope="col" class="hname">Habit</th>${head}<th scope="col" class="hcount">Done</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>` : `<section class="panel"><div class="empty"><p>No habits yet. Add your own, or start with a set of common ones you can edit.</p>
    <div class="row"><button class="btn primary" data-action="new-habit">Add a habit</button><button class="btn" data-action="starter">Use starter set</button></div></div></section>`}

  <div class="two-col">
    <section class="panel">
      <div class="panel-head"><h2>Weekly habits</h2><button class="btn small" data-action="new-weekly">Add</button></div>
      ${weekly.length ? `<div class="grid-scroll"><table class="habit-grid weekly"><thead><tr><th class="hname">Habit</th>${[...Array(wks)].map((_, i) => `<th scope="col"><span class="dn">W${i + 1}</span></th>`).join('')}<th class="hcount">Done</th></tr></thead><tbody>${weeklyRows}</tbody></table></div>`
      : `<p class="note">Things you do once a week, like laundry or meal prep. <button class="link" data-action="starter-weekly">Add a few examples</button></p>`}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Goals for ${S.month.toLocaleDateString('en-GB', { month: 'long' })}</h2><button class="btn small" data-action="new-goal">Add</button></div>
      ${goals.length ? `${meter(goals.length ? goalsDone / goals.length : 0, 'Goals done')}<p class="note">${goalsDone} of ${goals.length} reached</p>
        <ul class="checklist">${goals.map(g => `<li class="with-del"><button class="check-row ${g.data.done ? 'is-done' : ''}" data-action="toggle-goal" data-id="${g.id}" aria-pressed="${!!g.data.done}"><span class="box" aria-hidden="true"></span><span class="label">${esc(g.data.title)}</span></button><button class="icon-btn quiet" data-action="del-goal" data-id="${g.id}" aria-label="Delete goal">×</button></li>`).join('')}</ul>`
      : `<p class="note">Set a few goals for the month, like "Read one book".</p>`}
    </section>
    ${areaRows ? `<section class="panel span-2"><h2>By area</h2><ul class="area-list">${areaRows}</ul></section>` : ''}
  </div>`;
}

function taskRow(x) {
  const t = today(), p = x.data.projectId ? get(x.data.projectId) : null;
  const over = x.data.due && x.data.due < t && !x.data.done;
  return `<li class="task ${x.data.done ? 'is-done' : ''}">
    <button class="box-btn" data-action="toggle-task" data-id="${x.id}" aria-pressed="${!!x.data.done}" aria-label="Mark ${esc(x.data.title)} ${x.data.done ? 'not done' : 'done'}"><span class="box" aria-hidden="true"></span></button>
    <button class="task-main" data-action="edit-task" data-id="${x.id}">
      <span class="label">${esc(x.data.title)}</span>
      <span class="meta">${p ? `<span class="chip">${esc(p.data.name)}</span>` : ''}${x.data.due ? `<span class="${over ? 'late' : 'muted'}">${over ? 'Overdue, ' : ''}${x.data.due === t ? 'today' : fmtShort(x.data.due)}</span>` : ''}</span>
    </button></li>`;
}

function viewTasks() {
  const t = today(), all = list('task');
  const tabs = {
    today: { label: 'Today', items: all.filter(x => !x.data.done && x.data.due && x.data.due <= t) },
    upcoming: { label: 'Upcoming', items: all.filter(x => !x.data.done && x.data.due && x.data.due > t) },
    someday: { label: 'No date', items: all.filter(x => !x.data.done && !x.data.due) },
    done: { label: 'Done', items: all.filter(x => x.data.done) },
  };
  const cur = tabs[S.taskTab];
  const items = cur.items.sort((a, b) => S.taskTab === 'done' ? (b.updated_at || '').localeCompare(a.updated_at || '') : (a.data.due || '').localeCompare(b.data.due || ''));
  const projects = list('project');
  return `
  <header class="page-head"><h1>Tasks</h1></header>
  <form class="quick-add" data-form="quick-task">
    <label class="sr" for="qt">New task</label>
    <input id="qt" name="title" placeholder="Add a task…" autocomplete="off" required>
    <input name="due" type="date" value="${S.taskTab === 'today' ? t : ''}" aria-label="Due date">
    <button class="btn primary">Add</button>
  </form>
  <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" aria-selected="${k === S.taskTab}" data-action="task-tab" data-tab="${k}">${v.label}<span class="count">${v.items.length}</span></button>`).join('')}</div>
  <section class="panel">
    ${items.length ? `<ul class="task-list">${items.map(taskRow).join('')}</ul>` : `<p class="note">${S.taskTab === 'done' ? 'Finished tasks show up here.' : 'Nothing here. Add a task above.'}</p>`}
  </section>
  <div class="panel-head section-head"><h2>Projects</h2><button class="btn small" data-action="new-project">Add project</button></div>
  ${projects.length ? `<div class="project-grid">${projects.map(p => {
    const ts = all.filter(x => x.data.projectId === p.id), done = ts.filter(x => x.data.done).length;
    const left = p.data.deadline ? Math.ceil((parse(p.data.deadline) - parse(t)) / 864e5) : null;
    return `<button class="panel project" data-action="edit-project" data-id="${p.id}">
      <span class="pname">${esc(p.data.name)}</span>
      <span class="muted">${done} of ${ts.length} tasks done</span>
      ${meter(ts.length ? done / ts.length : 0, p.data.name)}
      ${left !== null ? `<span class="${left < 0 ? 'late' : 'muted'}">${left < 0 ? `${-left} days late` : left === 0 ? 'Due today' : `${left} days to go`}</span>` : ''}
    </button>`;
  }).join('')}</div>` : `<section class="panel"><p class="note">Group tasks into projects, like an exam, a trip or a side project.</p></section>`}`;
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
      <td><input type="checkbox" ${e.done ? 'checked' : ''} data-w="${d}" data-list="exercises" data-i="${i}" data-k="done" aria-label="Done"></td>
      <td><input list="ex-list" value="${esc(e.name)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="name" aria-label="Exercise" placeholder="Exercise"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.5" value="${esc(e.weight)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="weight" aria-label="Weight in kg"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.sets)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="sets" aria-label="Sets"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.reps)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="reps" aria-label="Reps"></td>
      <td><input value="${esc(e.rest)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="rest" aria-label="Rest" placeholder="1 min"></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="exercises" data-i="${i}" aria-label="Remove exercise">×</button></td></tr>`).join('');
    const caRows = (w.cardio || []).map((e, i) => `<tr>
      <td><input type="checkbox" ${e.done ? 'checked' : ''} data-w="${d}" data-list="cardio" data-i="${i}" data-k="done" aria-label="Done"></td>
      <td><input list="cardio-list" value="${esc(e.name)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="name" aria-label="Cardio" placeholder="Cardio"></td>
      <td><input type="number" inputmode="numeric" min="0" value="${esc(e.time)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="time" aria-label="Minutes"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.speed)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="speed" aria-label="Speed km/h"></td>
      <td><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(e.distance)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="distance" aria-label="Distance km"></td>
      <td></td>
      <td><button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="cardio" data-i="${i}" aria-label="Remove cardio">×</button></td></tr>`).join('');
    const hasAny = (w.exercises || []).length || (w.cardio || []).length;
    return `<section class="panel day ${isToday ? 'is-today' : ''}">
      <div class="panel-head"><h2>${dt.toLocaleDateString('en-GB', { weekday: 'long' })} <span class="muted">${dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></h2></div>
      <input class="groups" value="${esc((w.groups || []).join(', '))}" data-w="${d}" data-k="groups" placeholder="Muscle groups, e.g. Chest, Triceps" aria-label="Muscle groups">
      ${hasAny ? `<div class="grid-scroll"><table class="workout">
        ${(w.exercises || []).length ? `<thead><tr><th></th><th>Exercise</th><th>kg</th><th>Sets</th><th>Reps</th><th>Rest</th><th></th></tr></thead><tbody>${exRows}</tbody>` : ''}
        ${(w.cardio || []).length ? `<thead><tr><th></th><th>Cardio</th><th>Min</th><th>km/h</th><th>km</th><th></th><th></th></tr></thead><tbody>${caRows}</tbody>` : ''}
      </table></div>` : ''}
      <div class="row"><button class="btn small" data-action="add-row" data-w="${d}" data-list="exercises">Add exercise</button><button class="btn small" data-action="add-row" data-w="${d}" data-list="cardio">Add cardio</button></div>
    </section>`;
  }).join('');
  return `
  <header class="page-head with-nav">
    <button class="icon-btn" data-action="week" data-dir="-1" aria-label="Previous week">‹</button>
    <h1>${S.week.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</h1>
    <button class="icon-btn" data-action="week" data-dir="1" aria-label="Next week">›</button>
  </header>
  <div class="summary">
    <div><span class="figure">${done}<small>/${planned}</small></span><span class="muted">exercises done</span></div>
    <div><span class="figure">${Math.round(volume).toLocaleString('en-GB')}</span><span class="muted">kg moved</span></div>
    <button class="btn" data-action="copy-week">Copy last week</button>
  </div>
  <div class="days">${cards}</div>
  <datalist id="ex-list">${EXERCISES.map(e => `<option value="${e}">`).join('')}</datalist>
  <datalist id="cardio-list">${CARDIO.map(e => `<option value="${e}">`).join('')}</datalist>`;
}

function syncLine() {
  const st = sync.status, pend = [...S.recs.values()].filter(r => !r.synced).length;
  const map = { syncing: 'Syncing…', offline: 'Offline. Changes sync when you are back online.', error: `Sync failed: ${esc(st.error || '')}`, idle: st.last ? `Synced ${agoText(st.last)}` : 'Ready to sync' };
  return `${map[st.state] || ''}${pend && st.state !== 'syncing' ? ` ${pend} ${pend === 1 ? 'change' : 'changes'} waiting.` : ''}`;
}
function accountSection() {
  const st = sync.status;
  if (st.state === 'unavailable') return `<section class="panel"><h2>Sync</h2><p class="note">Sync needs an internet connection the first time the app opens. Reopen the app while online.</p></section>`;
  if (!st.user) return `<section class="panel"><h2>Sync</h2>
    <p class="note">Sign in to keep your phone and laptop in sync. Use the same account on every device.</p>
    <form class="auth" data-form="auth">
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
      <div class="row"><button class="btn primary">Sign in</button><button type="button" class="btn" data-action="sign-up">Create account</button></div>
    </form></section>`;
  return `<section class="panel"><h2>Sync</h2>
    <p>Signed in as <strong>${esc(st.user.email)}</strong></p>
    <p class="note">${syncLine()}</p>
    <div class="row"><button class="btn" data-action="sync-now">Sync now</button><button class="btn" data-action="sign-out">Sign out</button></div></section>`;
}
function googleSection() {
  if (!google.configured()) return `<section class="panel"><h2>Google Calendar and Gmail</h2><p class="note">Add your Google client ID to config.js to turn this on. SETUP.md explains how.</p></section>`;
  if (!sync.status.user) return `<section class="panel"><h2>Google Calendar and Gmail</h2><p class="note">Sign in to sync first. Google accounts are linked to your sync account, so every device shows them.</p></section>`;
  const accts = google.G.data?.accounts || [];
  return `<section class="panel"><h2>Google Calendar and Gmail</h2>
    <p class="note">The app reads your calendar and the number of unread emails. It can't read, send or change emails or events.</p>
    ${accts.length ? `<ul class="conn">${accts.map(a => `<li><span>${esc(a.email)}${a.error === 'reconnect' ? ' <span class="late">(access expired)</span>' : ''}</span><span class="row tight">${a.error === 'reconnect' ? `<button class="btn small" data-action="g-connect">Reconnect</button>` : ''}<button class="btn small danger" data-action="g-remove" data-email="${esc(a.email)}">Remove</button></span></li>`).join('')}</ul>` : ''}
    <div class="row"><button class="btn primary" data-action="g-connect">Connect a Google account</button></div></section>`;
}

function viewMore() {
  let theme = 'system';
  try { theme = localStorage.getItem('theme') || 'system'; } catch {}
  const count = [...S.recs.values()].filter(r => !r.deleted).length;
  return `
  <header class="page-head"><h1>Settings</h1></header>
  ${db.isMemoryOnly() ? `<p class="warn">This browser blocked local storage, so changes are lost when you close the app. Open it in a normal (not private) window.</p>` : ''}
  <section class="panel">
    <h2>Appearance</h2>
    <div class="seg" role="radiogroup" aria-label="Theme">${['system', 'light', 'dark'].map(v => `<button role="radio" aria-checked="${v === theme}" data-action="theme" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
  </section>
  ${accountSection()}
  ${googleSection()}
  <section class="panel">
    <h2>Coming later</h2>
    <ul class="conn">
      <li><span>Obsidian vault</span><span class="muted">Phase 3</span></li>
      <li><span>Notion</span><span class="muted">Phase 4</span></li>
    </ul>
  </section>
  <section class="panel">
    <h2>Your data</h2>
    <p class="note">${count} items stored on this device.</p>
    <div class="row">
      <button class="btn" data-action="export">Export backup</button>
      <label class="btn">Import backup<input type="file" accept="application/json" id="import-file" hidden></label>
      <button class="btn danger" data-action="erase">Erase everything</button>
    </div>
  </section>
  ${S.installPrompt ? `<section class="panel"><h2>Install</h2><p class="note">Add the app to your home screen or dock.</p><button class="btn primary" data-action="install">Install app</button></section>` : ''}`;
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
  render.lastView = S.view;
}

/* ---------- forms in modal ---------- */
function habitForm(h) {
  openModal(`<form data-form="habit" data-id="${h ? h.id : ''}">
    <h2>${h ? 'Edit habit' : 'New habit'}</h2>
    <label>Name<input name="name" required value="${esc(h?.data.name || '')}" placeholder="e.g. Drink 2 L of water"></label>
    <label>Area<select name="area">${areaOptions(h?.data.area || 'health')}</select></label>
    ${h ? `<p class="note">Best streak: ${bestStreak(h.id)} days. Current: ${streak(h.id)} days.</p>` : ''}
    <div class="row end">${h ? `<button type="button" class="btn danger" data-action="del-habit" data-id="${h.id}">Delete</button>` : ''}
      <button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
}
function simpleForm(form, title, field, value, id, delAction) {
  openModal(`<form data-form="${form}" data-id="${id || ''}">
    <h2>${title}</h2>
    <label>${field}<input name="name" required value="${esc(value || '')}"></label>
    <div class="row end">${id && delAction ? `<button type="button" class="btn danger" data-action="${delAction}" data-id="${id}">Delete</button>` : ''}
      <button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
}
function taskForm(x, due) {
  openModal(`<form data-form="task" data-id="${x ? x.id : ''}">
    <h2>${x ? 'Edit task' : 'New task'}</h2>
    <label>Task<input name="title" required value="${esc(x?.data.title || '')}"></label>
    <label>Due date<input type="date" name="due" value="${esc(x?.data.due ?? due ?? '')}"></label>
    <label>Project<select name="projectId">${projectOptions(x?.data.projectId)}</select></label>
    <label>Notes<textarea name="notes" rows="3">${esc(x?.data.notes || '')}</textarea></label>
    <div class="row end">${x ? `<button type="button" class="btn danger" data-action="del-task" data-id="${x.id}">Delete</button>` : ''}
      <button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
}
function projectForm(p) {
  openModal(`<form data-form="project" data-id="${p ? p.id : ''}">
    <h2>${p ? 'Edit project' : 'New project'}</h2>
    <label>Name<input name="name" required value="${esc(p?.data.name || '')}"></label>
    <label>Deadline<input type="date" name="deadline" value="${esc(p?.data.deadline || '')}"></label>
    <div class="row end">${p ? `<button type="button" class="btn danger" data-action="del-project" data-id="${p.id}">Delete</button>` : ''}
      <button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
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
    if (!confirm('Delete this habit and its history?')) return;
    await remove(id);
    for (const l of list('habit_log').filter(r => r.data.habitId === id)) await remove(l.id);
    closeModal(); render(); toast('Habit deleted');
  },
  async starter() {
    let o = nextOrder('habit');
    for (const [name, area] of STARTER) await save('habit', uid(), { name, area, order: o++, start: today() });
    render(); toast('Starter habits added');
  },
  async 'starter-weekly'() {
    let o = nextOrder('weekly_habit');
    for (const name of STARTER_WEEKLY) await save('weekly_habit', uid(), { name, order: o++, checks: {} });
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
  'new-goal': () => simpleForm('goal', `New goal for ${S.month.toLocaleDateString('en-GB', { month: 'long' })}`, 'Goal'),
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
    if (!confirm('Delete this project? Its tasks stay, without a project.')) return;
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
    render(); toast(copied ? `Copied ${copied} ${copied === 1 ? 'day' : 'days'}` : 'Nothing to copy from last week');
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
    if (!confirm('Erase all habits, tasks and workouts on this device? Export a backup first if you want to keep them.')) return;
    await db.clearAll(); S.recs.clear(); render(); toast('Everything erased');
  },
  async install() { if (!S.installPrompt) return; S.installPrompt.prompt(); await S.installPrompt.userChoice; S.installPrompt = null; render(); },
  close: () => closeModal(),
  async 'sign-up'(_, el) {
    const f = el.closest('form');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    try {
      const inNow = await sync.signUp(fd.get('email').trim(), fd.get('password'));
      toast(inNow ? 'Account created' : 'Check your email and confirm, then sign in here.');
    } catch (e) { toast(e.message); }
  },
  async 'sign-out'() {
    if (!confirm('Sign out? Your data stays on this device.')) return;
    await sync.signOut(); google.clearCache(); render();
  },
  'sync-now': () => sync.syncNow(),
  async 'g-connect'() {
    try { const email = await google.connect(); toast(`Connected ${email}`); }
    catch (e) { toast(e.message); }
    render();
  },
  async 'g-remove'({ email }) {
    if (!confirm(`Remove ${email}? The app will stop showing its calendar and emails.`)) return;
    try { await google.disconnect(email); toast('Account removed'); } catch (e) { toast(e.message); }
    render();
  },
  async 'g-refresh'() { const p = google.refresh(); render(); await p; render(); },
};

const forms = {
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
    await sync.signIn(fd.get('email').trim(), fd.get('password'));
    toast('Signed in');
    google.preload();
    await google.refresh();
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
  try { await fn(new FormData(f), f.dataset.id); }
  catch (err) { toast(err.message || 'Something went wrong. Try again.'); return; }
  if ($('#modal').open) closeModal();
  render();
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'import-file' && el.files[0]) return importFile(el.files[0]);
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
    render(); toast(`Imported ${merged.length} items`);
  } catch { toast('That file is not a valid backup.'); }
}

function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem('theme') || 'system'; } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function route() {
  const v = location.hash.slice(1);
  S.view = VIEWS.includes(v) ? v : 'today';
  render();
}

window.addEventListener('hashchange', route);
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
    if (changed.length) { await db.putMany(changed); softRender(); }
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
      dot.title = sync.status.user ? syncLine().replace(/<[^>]+>/g, '') : 'Not signed in';
    }
    if (S.view === 'more') softRender();
  },
};
async function refreshGoogle() { await google.refresh(); if (S.view === 'today' || S.view === 'more') softRender(); }

/* ---------- start ---------- */
(async function start() {
  applyTheme();
  await db.open();
  (await db.loadAll()).forEach(r => S.recs.set(r.id, r));
  route();
  await sync.init(syncHooks);
  if (sync.status.user) { google.preload(); refreshGoogle(); }
  setInterval(() => { if (document.visibilityState === 'visible') refreshGoogle(); }, 15 * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - new Date(google.G.data?.fetched || 0) > 10 * 60000) refreshGoogle();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

// core.js
import * as db from './db.js';
import * as sync from './sync.js';
import * as push from './push.js';
import { tr, LOC } from './i18n.js';

/* ---------- constants ---------- */
export const BUILTIN_AREAS = {
  health:       { label: 'Health',        icon: '🫀' },
  mind:         { label: 'Mind',          icon: '🧘' },
  productivity: { label: 'Productivity',  icon: '🎯' },
  lifestyle:    { label: 'Lifestyle',     icon: '🌿' },
  work:         { label: 'Work & school', icon: '📚' },
  finance:      { label: 'Finance',       icon: '💶' },
};
export const AREA_EMOJIS = ['🎨', '🎸', '⚽', '🧠', '💼', '🏠', '❤️', '🌍', '✈️', '🐶', '🍎', '📖', '🙏', '💤', '🧹', '👨‍👩‍👧'];
export const STARTER = [
  ['Drink 2 L of water', 'health'], ['Morning stretching', 'health'],
  ['Read 10 pages', 'mind'], ['Plan tomorrow', 'productivity'],
  ['Deep work session', 'work'], ['Make the bed', 'lifestyle'],
  ['Track expenses', 'finance'],
];
export const STARTER_WEEKLY = ['Meal prep for the week', 'Do laundry', 'Clean my room', 'Review my budget'];
export const EXERCISES = ['Barbell bench press', 'Incline bench press', 'Push-ups', 'Dips', 'Tricep pushdown',
  'Pull-ups', 'Seated row', 'Lat pulldown', 'Bicep curl', 'Squat', 'Deadlift', 'Leg press',
  'Lunges', 'Shoulder press', 'Lateral raise', 'Plank'];
export const CARDIO = ['Treadmill', 'Jogging', 'Cycling', 'Rowing', 'Swimming', 'Jump rope'];
export const VIEWS = ['today', 'habits', 'tasks', 'train', 'more', 'plan', 'year', 'month', 'progress', 'reviews', 'stats'];

/* ---------- helpers ---------- */
export const $ = (s, el = document) => el.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const mondayOf = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const pct = v => `${Math.round(v * 100)}%`;
export const fmtShort = s => parse(s).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' });

/* ---------- state + storage ---------- */
export const S = {
  recs: new Map(),
  view: 'today',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  week: mondayOf(new Date()),
  taskTab: 'today',
  year: new Date().getFullYear(),
  reviewMonth: monthKey(new Date()),
  installPrompt: null,
  push: { perm: 'default', sub: false, busy: false },
  statsTab: 'month',
  gridMode: null, // 'week' | 'month' | null = automatic (week on phones, month on larger screens)
  gridWeek: null, // Monday shown in the week grid
};
export const isNarrow = () => matchMedia('(max-width: 699px)').matches;
export const gridMode = () => S.gridMode || (isNarrow() ? 'week' : 'month');

export const list = kind => [...S.recs.values()].filter(r => r.kind === kind && !r.deleted);
export const get = id => { const r = S.recs.get(id); return r && !r.deleted ? r : null; };

export async function save(kind, id, data) {
  const rec = { id, kind, data, updated_at: new Date().toISOString(), deleted: false, synced: false };
  S.recs.set(id, rec);
  await db.put(rec);
  sync.schedule();
  return rec;
}
export async function remove(id) {
  const r = S.recs.get(id);
  if (!r) return;
  const rec = { ...r, deleted: true, updated_at: new Date().toISOString(), synced: false };
  S.recs.set(id, rec);
  await db.put(rec);
  sync.schedule();
}

/* ---------- habit logic ---------- */
// A habit can run every day, on chosen weekdays (days: 0 = Monday … 6 = Sunday) or X times per week.
// A check-in is "full" or "mini" (the short version for busy days, worth half in percentages).
// Free day: for streaks, one missed scheduled day per calendar week is forgiven automatically.
// All habits, including archived ones (for history and stats).
export const allHabits = () => list('habit').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
// Habits in use: shown on Today and in the grids. Archived habits are left out.
export const habits = () => allHabits().filter(h => !h.data.archived);
export const habitName = h => h.data.name + (h.data.archived ? ` (${tr('archived')})` : '');
export const archivedHabits = () => allHabits().filter(h => h.data.archived);
// Days a habit didn't run: from archiving until today, and earlier archive periods ([from, to] pairs).
export const pausedOn = (h, d) => (!!h.data.archived && !!h.data.archivedAt && d >= h.data.archivedAt) || (h.data.pauses || []).some(([a, b]) => d >= a && d <= b);
export const logId = (h, d) => `log_${h}_${d}`;
export const logOf = (hid, d) => get(logId(hid, d))?.data;
export const isDone = (hid, d) => !!logOf(hid, d)?.done;
export const isMini = (hid, d) => logOf(hid, d)?.level === 'mini';
export const valueOn = (hid, d) => (isDone(hid, d) ? (isMini(hid, d) ? 0.5 : 1) : 0);
export const activeOn = (h, d) => (!h.data.start || h.data.start <= d) && !pausedOn(h, d);
export const freqOf = h => h.data.freq || 'daily';
export const isWeekly = h => freqOf(h) === 'weekly';
export const dayIdx = d => (parse(d).getDay() + 6) % 7;
export function scheduledOn(h, d) { // counts for daily stats on this day?
  if (!activeOn(h, d) || isWeekly(h)) return false;
  return freqOf(h) === 'days' ? (h.data.days || []).includes(dayIdx(d)) : true;
}
export const showToday = (h, d) => activeOn(h, d) && (isWeekly(h) || scheduledOn(h, d));
export const targetText = h => h.data.target ? `${h.data.target} ${tr(h.data.unit || '')}`.trim() : '';
export const miniText = h => h.data.mini ? `${h.data.mini} ${tr(h.data.unit || '')}`.trim() : '';
export function weekProgress(h, d) { // weekly habits: days done in the calendar week of d
  const mon = mondayOf(parse(d));
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(h.id, ymd(addDays(mon, i)))) n++;
  return { n, of: +h.data.perWeek || 3 };
}

export function dayStats(d, hs = allHabits()) {
  const el = hs.filter(h => scheduledOn(h, d));
  let done = 0, checkins = 0;
  el.forEach(h => { done += valueOn(h.id, d); if (isDone(h.id, d)) checkins++; });
  return { done, checkins, total: el.length, all: el.length > 0 && checkins === el.length, pct: el.length ? done / el.length : 0 };
}

// Streak with one forgiven day per calendar week. Returns the length and which days were forgiven.
export function streakInfo(hid) {
  const h = get(hid);
  const covered = new Set();
  if (!h) return { n: 0, covered };
  const t = today();
  if (isWeekly(h)) { // streak in weeks that reached the target
    let mon = mondayOf(new Date()), n = 0;
    if (weekProgress(h, ymd(mon)).n < (+h.data.perWeek || 3)) mon = addDays(mon, -7);
    while (n < 520 && activeOn(h, ymd(addDays(mon, 6))) && weekProgress(h, ymd(mon)).n >= (+h.data.perWeek || 3)) { n++; mon = addDays(mon, -7); }
    return { n, covered, weeks: true };
  }
  let d = parse(t), n = 0;
  if (!isDone(hid, t)) d = addDays(d, -1); // today still open: count up to yesterday
  const freeUsed = new Set();
  for (let guard = 0; guard < 4000; guard++) {
    const ds = ymd(d);
    if (!activeOn(h, ds)) break;
    if (scheduledOn(h, ds)) {
      if (isDone(hid, ds)) n++;
      else {
        const wk = weekKey(ds);
        if (freeUsed.has(wk)) break;
        freeUsed.add(wk); covered.add(ds);
      }
    }
    d = addDays(d, -1);
  }
  // a forgiven day at the very start of the chain isn't part of the streak
  return { n, covered: n ? covered : new Set() };
}
export const streak = hid => streakInfo(hid).n;
export function bestStreak(hid) {
  const h = get(hid);
  if (!h) return 0;
  const t = today();
  const firstLog = list('habit_log').filter(r => r.data.habitId === hid && r.data.done).map(r => r.data.date).sort()[0];
  if (!firstLog) return 0;
  if (isWeekly(h)) {
    let mon = mondayOf(parse(firstLog)), run = 0, best = 0;
    while (ymd(mon) <= t) { if (weekProgress(h, ymd(mon)).n >= (+h.data.perWeek || 3)) best = Math.max(best, ++run); else if (ymd(addDays(mon, 6)) < t) run = 0; mon = addDays(mon, 7); }
    return best;
  }
  let d = parse(firstLog), run = 0, best = 0;
  const freeUsed = new Set();
  while (ymd(d) <= t) {
    const ds = ymd(d);
    if (scheduledOn(h, ds)) {
      if (isDone(hid, ds)) best = Math.max(best, ++run);
      else if (ds < t) { const wk = weekKey(ds); if (freeUsed.has(wk)) run = 0; else freeUsed.add(wk); }
    }
    d = addDays(d, 1);
  }
  return best;
}
// One habit over a list of days: score (mini = half), scheduled days, check-ins, best run inside the period.
export function habitPeriod(h, days) {
  const t = today(), past = days.filter(d => d <= t);
  if (isWeekly(h)) {
    const weeks = [...new Set(past.map(d => weekKey(d)))];
    const mondays = [...new Set(past.map(d => ymd(mondayOf(parse(d)))))].filter(m => activeOn(h, ymd(addDays(parse(m), 6))));
    const met = mondays.filter(m => weekProgress(h, m).n >= (+h.data.perWeek || 3)).length;
    return { done: met, total: mondays.length, checkins: past.filter(d => isDone(h.id, d)).length, best: bestStreak(h.id), weeks: true, weeksTotal: weeks.length };
  }
  let done = 0, total = 0, checkins = 0, run = 0, best = 0;
  past.forEach(d => {
    if (!scheduledOn(h, d)) return;
    total++; done += valueOn(h.id, d);
    if (isDone(h.id, d)) { checkins++; best = Math.max(best, ++run); } else run = 0;
  });
  return { done, total, checkins, best };
}
export function monthStats(y, m) {
  const n = daysInMonth(y, m), t = today(), hs = allHabits();
  let done = 0, total = 0, perfect = 0, checkins = 0;
  const days = [];
  for (let i = 1; i <= n; i++) {
    const d = `${y}-${pad(m + 1)}-${pad(i)}`;
    const s = dayStats(d, hs);
    const future = d > t;
    days.push({ d, ...s, future });
    if (!future) { done += s.done; total += s.total; checkins += s.checkins; if (s.all) perfect++; }
  }
  return { days, done, total, perfect, checkins, pct: total ? done / total : 0 };
}
// "▲ +7 vs September" (percentage points) or "▲ +2" for counts
export function delta(cur, prev, label, isPct = true) {
  if (prev == null) return '';
  const diff = isPct ? Math.round((cur - prev) * 100) : cur - prev;
  if (!diff) return `<span class="delta same">= ${label ? tr('same as {when}', { when: label }) : ''}</span>`;
  return `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' + diff : '▼ −' + Math.abs(diff)}${label ? ' ' + tr('vs {when}', { when: label }) : ''}</span>`;
}

// Insights from the last 90 days: weekday pattern, a habit's best weekday, habits that slipped or improved.
/* ---------- calendar weeks ---------- */
export function isoWeek(dt) {
  const x = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return { year: x.getUTCFullYear(), week: Math.ceil(((x - y0) / 864e5 + 1) / 7) };
}
export const weekKey = d => { const w = isoWeek(typeof d === 'string' ? parse(d) : d); return `${w.year}-W${pad(w.week)}`; };
export const weekNum = key => +key.slice(-2);
export const weekCls = key => `wk${weekNum(key) % 6}`; // same color for the same calendar week everywhere
export const cwLabel = key => tr('CW {n}', { n: weekNum(key) });
export function monthWeeks(y, m) { // calendar weeks touching this month, with their days
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
export async function migrateWeekly() {
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
export const meter = (v, label = '') => `<div class="meter" role="progressbar" aria-valuenow="${Math.round(v * 100)}" aria-valuemin="0" aria-valuemax="100" ${label ? `aria-label="${esc(label)}"` : ''}><span style="width:${Math.round(v * 100)}%"></span></div>`;
// Areas: the built-in ones (which can be renamed or removed) plus your own.
export function allAreas() {
  const out = [];
  Object.entries(BUILTIN_AREAS).forEach(([k, a], i) => {
    const o = get('area_' + k)?.data;
    if (o?.hidden) return;
    out.push({ id: k, label: o?.name || tr(a.label), icon: o?.icon || a.icon, builtin: true, order: o?.order ?? i });
  });
  list('area').filter(r => r.data.custom).forEach(r => out.push({ id: r.id, label: r.data.name, icon: r.data.icon || '🏷️', order: r.data.order ?? 100 }));
  return out.sort((x, y) => x.order - y.order);
}
export const areaInfo = id => allAreas().find(x => x.id === id) || { id: '', label: tr('No area'), icon: '•' };
export const areaOptions = sel => allAreas().map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.icon)} ${esc(x.label)}</option>`).join('')
  + `<option value="" ${!allAreas().some(x => x.id === sel) ? 'selected' : ''}>• ${tr('No area')}</option>`;
export const projectOptions = sel => `<option value="">${tr("No project")}</option>` + list('project').map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.data.name)}</option>`).join('');

// Short message at the bottom. With opt.action it gets a button (e.g. "Undo") and stays longer.
// opt.onTimeout runs when the message goes away without the button being used; if another message
// replaces it first, that pending step runs right away so nothing is left half done.
export function toast(msg, opt = {}) {
  const t = $('#toast');
  const pending = toast.pending; toast.pending = null;
  clearTimeout(toast.tm);
  if (pending) pending();
  const modal = $('#modal'), host = modal?.open ? modal : document.body; // stay visible above an open dialog
  if (t.parentElement !== host) host.appendChild(t);
  t.replaceChildren();
  const text = document.createElement('span'); text.textContent = tr(msg); t.append(text);
  t.classList.toggle('has-action', !!opt.action);
  if (opt.action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-action'; b.textContent = tr(opt.action);
    b.addEventListener('click', e => {
      e.stopPropagation();
      toast.pending = null; clearTimeout(toast.tm);
      t.classList.remove('show', 'has-action');
      opt.onAction?.();
    });
    t.append(b);
  }
  toast.pending = opt.onTimeout || null;
  t.classList.add('show');
  toast.tm = setTimeout(() => {
    t.classList.remove('show', 'has-action');
    const p = toast.pending; toast.pending = null; p?.();
  }, opt.duration || 2200);
}
// Put the toast back on the page when a dialog closes.
export function resetToastHost() { const t = $('#toast'); if (t && t.parentElement !== document.body) document.body.appendChild(t); }
// "Perfect day": shown once when the last habit of today is checked off.
export function celebrate() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('celebrate')?.remove();
  const el = document.createElement('div');
  el.id = 'celebrate';
  el.className = 'celebrate' + (calm ? ' calm' : '');
  el.setAttribute('role', 'status');
  const bits = calm ? '' : [...Array(14)].map((_, i) => {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 110 + Math.random() * 50;
    return `<i style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px;--r:${Math.round(Math.random() * 180 - 90)}deg"></i>`;
  }).join('');
  el.innerHTML = `<div class="cel-card"><svg class="cel-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><path d="M39 62l14 14 29-31"/></svg><strong>${tr('Perfect day')}</strong><span>${tr('Every habit for today is done.')}</span></div>${bits}`;
  document.body.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', close);
  setTimeout(close, calm ? 2400 : 2000);
}

export function openModal(html) {
  const m = $('#modal');
  $('#modal-body').innerHTML = html;
  if (!m.open) m.showModal();
  const first = m.querySelector('input, select, textarea');
  if (first) first.focus();
}
export const closeModal = () => $('#modal').close();

export function agoText(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? tr('just now') : m < 60 ? tr('{n} min ago', { n: m }) : m < 1440 ? tr('{n} h ago', { n: Math.round(m / 60) }) : fmtShort(ymd(new Date(iso)));
}

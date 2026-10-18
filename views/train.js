// views/train.js
import { tr, LOC } from '../i18n.js';
import { $, CARDIO, EXERCISES, S, addDays, esc, get, list, mondayOf, parse, today, ymd } from '../core.js';
import { weekStrip } from './strip.js';

/* ---------- training plan ---------- */
export const PLAN_ID = 'setting_trainplan';
export const planData = () => get(PLAN_ID)?.data || null;
export const weekdayIdx = d => (parse(d).getDay() + 6) % 7; // 0 = Monday
export const dayHasContent = x => !!x && ((x.exercises || []).length || (x.cardio || []).length);
export const hasPlan = () => Object.values(planData()?.days || {}).some(dayHasContent);
export function planCopy(d) {
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
export function workoutFor(d) {
  const own = get(`workout_${d}`)?.data;
  if (own) return { w: own, fromPlan: false };
  const p = planCopy(d);
  return p ? { w: p, fromPlan: true } : { w: { groups: [], exercises: [], cardio: [] }, fromPlan: false };
}

// One editable day card. key = a date (week view) or "plan-0".."plan-6" (weekly plan).
export function dayCard(key, title, sub, w, opts = {}) {
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
export const datalists = () => `<datalist id="ex-list">${EXERCISES.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>
  <datalist id="cardio-list">${CARDIO.map(e => `<option value="${esc(tr(e))}">`).join('')}</datalist>`;

// ---------- Training page: week strip, progress ring, exercises by muscle group ----------
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Full body', 'Other'];
const GUESS = [
  [/bench|push-?up|fly|chest|bankdr|liegest|brust/i, 'Chest'],
  [/pull-?up|chin|row|lat|deadlift|back|klimmz|rudern|latzug|latzieh|kreuzheb|rücken/i, 'Back'],
  [/shoulder|lateral|overhead|military|schulter|seitheb/i, 'Shoulders'],
  [/curl|bicep|bizeps/i, 'Biceps'],
  [/tricep|dip|skull|trizeps/i, 'Triceps'],
  [/squat|leg|lunge|calf|hip thrust|kniebeug|bein|ausfall|wade/i, 'Legs'],
  [/plank|crunch|sit-?up|core|abs|unterarmst|bauch/i, 'Core'],
];
export const guessMuscle = name => (GUESS.find(([re]) => re.test(name || '')) || [, ''])[1];
export const muscleOf = (e, w) => e.group || guessMuscle(e.name) || (w.groups?.length === 1 && MUSCLES.includes(w.groups[0]) ? w.groups[0] : '') || 'Other';
// Units that fill the ring: every set of every exercise, every cardio entry counts as one.
export const setsOf = e => Math.max(1, Math.min(12, parseInt(e.sets, 10) || 1));
export const setsDoneOf = e => Math.min(setsOf(e), e.setsDone != null ? +e.setsDone || 0 : (e.done ? setsOf(e) : 0));
export function ringProgress(w) {
  let total = 0, done = 0;
  (w.exercises || []).forEach(e => { total += setsOf(e); done += setsDoneOf(e); });
  (w.cardio || []).forEach(c => { total += 1; done += c.done ? 1 : 0; });
  return { total, done, pct: total ? done / total : 0 };
}
export const trainDay = () => S.trainDay || today();

function ring(p) {
  const R = 80, C = 2 * Math.PI * R;
  return `<div class="ring-wrap" role="img" aria-label="${tr('{done} of {total} sets', { done: p.done, total: p.total })}">
    <svg class="t-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="t-track" cx="100" cy="100" r="${R}"/><circle class="t-fill" cx="100" cy="100" r="${R}" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C * (1 - p.pct)).toFixed(1)}"/></svg>
    <div class="ring-center"><span class="ring-pct">${Math.round(p.pct * 100)}<small>%</small></span><span class="ring-sub">${tr('{done} of {total} sets', { done: p.done, total: p.total })}</span></div>
  </div>`;
}

function exCard(e, i, d) {
  const n = setsOf(e), sd = setsDoneOf(e);
  return `<li class="ex-card ${sd >= n ? 'is-done' : ''}">
    <div class="ex-top">
      <input class="ex-name" list="ex-list" value="${esc(e.name)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="name" aria-label="${tr('Exercise')}" placeholder="${tr('Exercise')}">
      <button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="exercises" data-i="${i}" aria-label="${tr('Remove exercise')}">×</button>
    </div>
    <div class="ex-fields">
      <label><span>${tr('kg')}</span><input type="number" inputmode="decimal" min="0" step="0.5" value="${esc(e.weight)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="weight"></label>
      <label><span>${tr('Sets')}</span><input type="number" inputmode="numeric" min="1" max="12" value="${esc(e.sets)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="sets"></label>
      <label><span>${tr('Reps')}</span><input type="number" inputmode="numeric" min="0" value="${esc(e.reps)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="reps"></label>
      <label><span>${tr('Rest')}</span><input value="${esc(e.rest)}" data-w="${d}" data-list="exercises" data-i="${i}" data-k="rest" placeholder="${tr('1 min')}"></label>
    </div>
    <div class="ex-sets" role="group" aria-label="${tr('Sets')}">${[...Array(n)].map((_, s) => `<button class="set-dot ${s < sd ? 'on' : ''}" data-action="tick-set" data-w="${d}" data-i="${i}" data-s="${s}" aria-pressed="${s < sd}" aria-label="${tr('Set {n}', { n: s + 1 })}">${s + 1}</button>`).join('')}
      <select class="ex-group" data-w="${d}" data-list="exercises" data-i="${i}" data-k="group" aria-label="${tr('Muscle group')}">${MUSCLES.map(m => `<option value="${m}" ${(e.group || '') === m ? 'selected' : ''}>${tr(m)}</option>`).join('')}<option value="" ${!e.group ? 'selected' : ''}>${tr('Automatic')}</option></select>
    </div>
  </li>`;
}

export function viewTrain() {
  const d = trainDay(), dt = parse(d), t = today();
  const { w, fromPlan } = workoutFor(d);
  const p = ringProgress(w);
  const mon = mondayOf(dt), marks = {};
  let planned = 0, doneW = 0, volume = 0;
  [...Array(7)].forEach((_, i) => {
    const x = ymd(addDays(mon, i)), wx = workoutFor(x).w, px = ringProgress(wx);
    if (px.total) marks[x] = px.done >= px.total ? 'done' : px.done ? 'part' : '';
    (wx.exercises || []).forEach(e => { planned++; if (setsDoneOf(e) >= setsOf(e)) { doneW++; volume += (+e.weight || 0) * (+e.sets || 0) * (+e.reps || 0); } });
  });
  const groups = {};
  (w.exercises || []).forEach((e, i) => { const g = muscleOf(e, w); (groups[g] ||= []).push(exCard(e, i, d)); });
  const order = [...MUSCLES.filter(m => groups[m]), ...Object.keys(groups).filter(g => !MUSCLES.includes(g))];
  const cardio = (w.cardio || []).map((c, i) => `<li class="ex-card cardio ${c.done ? 'is-done' : ''}">
      <div class="ex-top"><button class="pl-check" data-action="tick-ex" data-w="${d}" data-list="cardio" data-i="${i}" aria-pressed="${!!c.done}" aria-label="${tr('Done')}"><span aria-hidden="true"></span></button>
        <input class="ex-name" list="cardio-list" value="${esc(c.name)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="name" aria-label="${tr('Cardio')}" placeholder="${tr('Cardio')}">
        <button class="icon-btn quiet" data-action="del-row" data-w="${d}" data-list="cardio" data-i="${i}" aria-label="${tr('Remove cardio')}">×</button></div>
      <div class="ex-fields three">
        <label><span>${tr('Min')}</span><input type="number" inputmode="numeric" min="0" value="${esc(c.time)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="time"></label>
        <label><span>${tr('km/h')}</span><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(c.speed)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="speed"></label>
        <label><span>${tr('km')}</span><input type="number" inputmode="decimal" min="0" step="0.1" value="${esc(c.distance)}" data-w="${d}" data-list="cardio" data-i="${i}" data-k="distance"></label>
      </div></li>`).join('');
  const resettable = !fromPlan && !!get(`workout_${d}`) && !!planCopy(d);
  return `
  <header class="page-head">
    <p class="sub">${dt.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${tr('Training')}</h1>
  </header>
  ${weekStrip(mon, d, { pick: 'train-day', week: 'train-week', marks })}
  <div class="train-layout">
    <section class="panel ring-panel ${p.total && p.done >= p.total ? 'complete' : ''}">
      ${p.total ? ring(p) : `<div class="ring-empty">${ring({ total: 0, done: 0, pct: 0 })}</div>`}
      <input class="groups ring-groups" value="${esc((w.groups || []).join(', '))}" data-w="${d}" data-k="groups" placeholder="${tr('Muscle groups, e.g. Chest, Triceps')}" aria-label="${tr('Muscle groups')}">
      <div class="ring-meta">
        ${fromPlan ? `<span class="chip">${tr('From your plan')}</span>` : ''}
        <label class="time-chip"><span>${tr('Time (optional)')}</span><input type="time" value="${esc(w.time || '')}" data-w="${d}" data-k="time"></label>
      </div>
      ${!p.total ? `<p class="note">${tr('Add exercises below. Every set you finish fills the circle.')}</p>` : p.done >= p.total ? `<p class="note ring-done">${tr('Workout complete. Well done!')}</p>` : `<p class="note">${tr('Tap the numbered circles after each set.')}</p>`}
    </section>
    <div class="ex-col">
      ${order.map(g => `<section class="muscle"><h2>${tr(g)}</h2><ul class="ex-list">${groups[g].join('')}</ul></section>`).join('')}
      ${cardio ? `<section class="muscle"><h2>${tr('Cardio')}</h2><ul class="ex-list">${cardio}</ul></section>` : ''}
      <div class="row ex-add"><button class="btn primary" data-action="add-row" data-w="${d}" data-list="exercises">${tr('Add exercise')}</button><button class="btn" data-action="add-row" data-w="${d}" data-list="cardio">${tr('Add cardio')}</button>
        ${resettable ? `<button class="link small-link" data-action="reset-day" data-w="${d}">${tr('Use plan for this day')}</button>` : ''}</div>
    </div>
  </div>
  <div class="summary week-sum">
    <div><span class="figure">${doneW}<small>/${planned}</small></span><span class="muted">${tr('exercises done this week')}</span></div>
    <div><span class="figure">${Math.round(volume).toLocaleString(LOC())}</span><span class="muted">${tr('kg moved')}</span></div>
    <span class="summary-actions"><a class="btn" href="#progress">${tr('Progress')}</a><a class="btn" href="#plan">${tr(hasPlan() ? 'Weekly plan' : 'Set up weekly plan')}</a></span>
  </div>
  ${!hasPlan() ? `<p class="note hint">${tr('Tip: set up a weekly plan once, and every week fills itself in automatically.')} <button class="link" data-action="copy-week">${tr('Or copy last week')}</button></p>` : ''}
  ${datalists()}`;
}

export function viewPlan() {
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

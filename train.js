// views/train.js
import { tr, LOC } from '../i18n.js';
import { $, CARDIO, EXERCISES, S, addDays, esc, get, list, mondayOf, parse, today, ymd } from '../core.js';

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

export function viewTrain() {
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
    <span class="summary-actions"><a class="btn" href="#progress">${tr('Progress')}</a><a class="btn primary" href="#plan">${tr(hasPlan() ? 'Weekly plan' : 'Set up weekly plan')}</a></span>
  </div>
  ${!hasPlan() ? `<p class="note hint">${tr('Tip: set up a weekly plan once, and every week fills itself in automatically.')} <button class="link" data-action="copy-week">${tr('Or copy last week')}</button></p>` : ''}
  <div class="days">${cards}</div>
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

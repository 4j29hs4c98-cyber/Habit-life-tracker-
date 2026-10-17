// views/today.js
import { tr, LOC } from '../i18n.js';
import { $, dayStats, esc, habits, isDone, isMini, isWeekly, list, meter, miniText, monthKey, monthStats, pct, showToday, streak, streakInfo, targetText, today, weekProgress } from '../core.js';
import { taskRow } from './tasks.js';
import { workoutFor } from './train.js';

/* ---------- views ---------- */
// Today's exercises, each one tickable right here.
function trainingChecklist(w, t) {
  const ex = (w.exercises || []).map((e, i) => ({ e, i, list: 'exercises', detail: [e.weight ? `${e.weight} kg` : '', e.sets && e.reps ? `${e.sets} × ${e.reps}` : ''].filter(Boolean).join(' · ') }));
  const ca = (w.cardio || []).map((e, i) => ({ e, i, list: 'cardio', detail: [e.time ? `${e.time} ${tr('min')}` : '', e.distance ? `${e.distance} km` : ''].filter(Boolean).join(' · ') }));
  const all = [...ex, ...ca], done = all.filter(x => x.e.done).length;
  return `<p class="lead">${esc((w.groups || []).join(', ') || tr('Workout planned'))}</p>
    ${meter(all.length ? done / all.length : 0, tr('Exercises done'))}
    <p class="note">${tr('{done} of {total} done', { done, total: all.length })}</p>
    <ul class="checklist ex-check">${all.map(x => `<li><button class="check-row ${x.e.done ? 'is-done' : ''}" data-action="tick-ex" data-w="${t}" data-list="${x.list}" data-i="${x.i}" aria-pressed="${!!x.e.done}">
      <span class="box" aria-hidden="true"></span><span class="label"><span>${esc(x.e.name || tr(x.list === 'cardio' ? 'Cardio' : 'Exercise'))}</span>${x.detail ? `<small class="muted">${esc(x.detail)}</small>` : ''}</span></button></li>`).join('')}</ul>`;
}

export function viewToday() {
  const now = new Date(), t = today();
  const hs = habits().filter(h => showToday(h, t));
  const ds = dayStats(t);
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const streaks = habits().map(h => ({ h, s: streak(h.id) })).sort((a, b) => b.s - a.s);
  const top = streaks[0];
  const due = list('task').filter(x => !x.data.done && x.data.due && x.data.due <= t).sort((a, b) => a.data.due.localeCompare(b.data.due));
  const w = workoutFor(t).w;

  const habitList = hs.length ? `<ul class="checklist">${hs.map(h => {
    const done = isDone(h.id, t), mini = isMini(h.id, t), si = streakInfo(h.id), s = si.n;
    const wp = isWeekly(h) ? weekProgress(h, t) : null;
    const sub = [targetText(h), wp ? tr('{n} of {of} this week', { n: wp.n, of: wp.of }) : ''].filter(Boolean).join(' · ');
    return `<li class="today-habit ${h.data.mini ? 'has-mini' : ''}"><button class="check-row ${done ? 'is-done' : ''} ${mini ? 'is-mini' : ''}" data-action="toggle" data-mode="full" data-h="${h.id}" data-d="${t}" aria-pressed="${done}">
      <span class="box" aria-hidden="true"></span><span class="label">${esc(h.data.name)}${mini ? ` <span class="mini-tag">${tr('MINI')}</span>` : ''}${sub ? `<small class="muted sub-line">${esc(sub)}</small>` : ''}</span>
      ${s ? `<span class="streak" title="${tr("Current streak")}">${si.weeks ? tr(s === 1 ? '{n} week' : '{n} weeks', { n: s }) : tr(s === 1 ? '{n} day' : '{n} days', { n: s })}</span>` : ''}</button>
      ${h.data.mini ? `<button class="mini-btn ${mini ? 'on' : ''}" data-action="toggle" data-mode="mini" data-h="${h.id}" data-d="${t}" aria-pressed="${mini}" title="${tr('Mini version')}: ${esc(miniText(h))}">${tr('Mini')}<small>${esc(miniText(h))}</small></button>` : ''}</li>`;
  }).join('')}</ul>` : `<div class="empty"><p>${tr("No habits yet. Add your own, or start with a set of common ones you can edit.")}</p>
      <div class="row"><button class="btn primary" data-action="new-habit">${tr("Add a habit")}</button><button class="btn" data-action="starter">${tr("Use starter set")}</button></div></div>`;

  return `
  <header class="page-head">
    <p class="sub">${now.toLocaleDateString(LOC(), { weekday: 'long' })}</p>
    <h1>${now.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' })}</h1>
  </header>
  <div class="today-layout">
    <section class="panel span-2">
      <div class="panel-head"><h2>${tr("Habits today")}</h2><p class="figure">${ds.checkins}<small> ${tr('of')} ${ds.total}</small></p></div>
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
      ${w && (w.exercises?.length || w.cardio?.length) ? trainingChecklist(w, t)
      : `<p class="note">${tr("Rest day, or nothing planned yet.")}</p>`}
    </section>
  </div>`;
}

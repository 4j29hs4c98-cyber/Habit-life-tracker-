// views/today.js
// Today as one plan: dark header (greeting, date, week strip), quick access row on phones,
// "Today's plan" timeline (habits, tasks, workout, journal sorted by time) and the month at a glance.
import { tr, LOC } from '../i18n.js';
import { S, addDays, dayStats, esc, get, habits, isDone, isMini, isWeekly, list, meter, miniText, mondayOf, monthKey, monthStats, parse, pct, showToday, streak, streakInfo, targetText, today, weekProgress, ymd } from '../core.js';
import { workoutFor } from './train.js';
import { weekStrip } from './strip.js';
import { journalPlanItem } from './journal.js';
import { headerImageStyle } from '../heroimg.js';

export const planDay = () => S.planDay || today();

function greeting() {
  const h = new Date().getHours();
  const word = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = (get('setting_prefs')?.data?.name || '').trim();
  return name ? tr(word + ', {name}', { name }) : tr(word);
}

// All plan items for one day, sorted by time (items without a time last).
export function planItems(d) {
  const t = today(), items = [];
  habits().filter(h => showToday(h, d)).forEach((h, i) => {
    const done = isDone(h.id, d), mini = isMini(h.id, d), si = streakInfo(h.id);
    const wp = isWeekly(h) ? weekProgress(h, d) : null;
    const s = d === t ? si.n : 0;
    items.push({ kind: 'habit', order: i, time: h.data.time || '', done, mini, h,
      title: h.data.name,
      sub: [targetText(h), wp ? tr('{n} of {of} this week', { n: wp.n, of: wp.of }) : '', s ? (si.weeks ? tr(s === 1 ? '{n} week' : '{n} weeks', { n: s }) : tr(s === 1 ? '1 day streak' : '{n} day streak', { n: s })) : ''].filter(Boolean).join(' · ') });
  });
  list('task').filter(x => x.data.due === d || (d === t && !x.data.done && x.data.due && x.data.due < t)).forEach((x, i) => {
    const p = x.data.projectId ? get(x.data.projectId) : null;
    items.push({ kind: 'task', order: 100 + i, time: x.data.time || '', done: !!x.data.done, x, title: x.data.title,
      sub: [x.data.due < t && !x.data.done ? tr('Overdue since {date}', { date: parse(x.data.due).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }) }) : '', p ? p.data.name : ''].filter(Boolean).join(' · ') || tr('Task') });
  });
  const w = workoutFor(d).w, all = [...(w.exercises || []), ...(w.cardio || [])];
  if (all.length) {
    const n = all.filter(e => e.done).length;
    items.push({ kind: 'workout', order: 200, time: w.time || '', done: n === all.length, part: n / all.length, title: (w.groups || []).join(', ') || tr('Workout'),
      sub: tr('{done} of {total} exercises', { done: n, total: all.length }) });
  }
  const j = journalPlanItem(d);
  if (j) items.push({ ...j, order: 300 });
  return items.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || '') || a.order - b.order);
}

function planRow(it, d) {
  const future = d > today();
  const time = it.time ? `<span class="pl-time">${esc(it.time)}</span>` : '';
  if (it.kind === 'habit') {
    const h = it.h;
    return `<li class="pl-item ${it.done ? 'is-done' : ''}">
      <button class="pl-check ${it.mini ? 'is-mini' : ''}" data-action="toggle" data-mode="full" data-h="${h.id}" data-d="${d}" ${future ? 'disabled' : ''} aria-pressed="${it.done}" aria-label="${esc(it.title)}"><span aria-hidden="true"></span></button>
      <button class="pl-body" data-action="edit-habit" data-id="${h.id}"><span class="pl-title">${esc(it.title)}${it.mini ? ` <span class="mini-tag">${tr('MINI')}</span>` : ''}</span>${it.sub ? `<span class="pl-sub">${esc(it.sub)}</span>` : ''}</button>
      ${h.data.mini && !future ? `<button class="mini-btn ${it.mini ? 'on' : ''}" data-action="toggle" data-mode="mini" data-h="${h.id}" data-d="${d}" aria-pressed="${it.mini}" title="${tr('Mini version')}: ${esc(miniText(h))}">${tr('Mini')}</button>` : ''}
      ${time}</li>`;
  }
  if (it.kind === 'task') {
    return `<li class="pl-item ${it.done ? 'is-done' : ''}">
      <button class="pl-check" data-action="toggle-task" data-id="${it.x.id}" aria-pressed="${it.done}" aria-label="${esc(it.title)}"><span aria-hidden="true"></span></button>
      <button class="pl-body" data-action="edit-task" data-id="${it.x.id}"><span class="pl-title">${esc(it.title)}</span><span class="pl-sub">${esc(it.sub)}</span></button>${time}</li>`;
  }
  if (it.kind === 'workout') {
    const deg = Math.round((it.part || 0) * 360);
    return `<li class="pl-item ${it.done ? 'is-done' : ''}">
      <span class="pl-check pl-ring" style="--deg:${deg}deg" aria-hidden="true"><span></span></span>
      <button class="pl-body" data-action="open-train-day" data-d="${d}"><span class="pl-title">${esc(it.title)}</span><span class="pl-sub">${esc(it.sub)}</span></button>${time}</li>`;
  }
  if (it.kind === 'journal') {
    return `<li class="pl-item ${it.done ? 'is-done' : ''}">
      <span class="pl-check pl-static" aria-hidden="true"><span></span></span>
      <button class="pl-body" data-action="open-journal" data-d="${d}"><span class="pl-title">${esc(it.title)}</span><span class="pl-sub">${esc(it.sub)}</span></button>${time}</li>`;
  }
  return '';
}

export function viewToday() {
  const now = new Date(), t = today(), d = planDay();
  const items = planItems(d), done = items.filter(i => i.done).length;
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const streaks = habits().map(h => ({ h, s: streak(h.id) })).sort((a, b) => b.s - a.s), top = streaks[0];
  const mon = mondayOf(parse(d));
  const marks = {};
  [...Array(7)].forEach((_, i) => { const x = ymd(addDays(mon, i)); if (x <= t) { const st = dayStats(x); if (st.total) marks[x] = st.all ? 'done' : st.checkins ? 'part' : ''; } });
  const dt = parse(d);
  const img = headerImageStyle();
  return `
  <header class="page-head hero ${img ? 'has-img' : ''}" ${img ? `style="${img}"` : ''}>
    <p class="hero-greet">${esc(greeting())}</p>
    <h1 class="hero-date">${dt.toLocaleDateString(LOC(), { weekday: 'long' })}, ${dt.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' })}</h1>
    ${d !== t ? `<button class="hero-back" data-action="plan-day" data-d="${t}">${tr('Back to today')}</button>` : ''}
    ${weekStrip(mon, d, { pick: 'plan-day', week: 'plan-week', marks, cls: 'on-dark' })}
  </header>
  <nav class="quick-row" aria-label="${tr('Quick access')}">
    <a href="#habits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>${tr('Habits')}</span></a>
    <a href="#train"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/></svg><span>${tr('Training')}</span></a>
    <a href="#tasks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M12 19h8"/></svg><span>${tr('Tasks')}</span></a>
    ${journalPlanItem.enabled?.() ? `<a href="#journal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/><path d="M9 7h6M9 11h6"/></svg><span>${tr('Journal')}</span></a>` : ''}
  </nav>
  <div class="today-layout">
    <section class="panel span-2 plan-panel">
      <div class="panel-head"><h2>${tr(d === t ? "Today's plan" : 'Plan for this day')}</h2><p class="figure">${pct(items.length ? done / items.length : 0)}</p></div>
      ${meter(items.length ? done / items.length : 0, tr('Plan progress'))}
      <p class="note">${tr('{done} of {total} completed', { done, total: items.length })}</p>
      ${items.length ? `<ul class="plan-list">${items.map(it => planRow(it, d)).join('')}</ul>`
        : `<div class="empty"><p>${tr('Nothing planned for this day.')}</p><div class="row"><button class="btn primary" data-action="new-habit">${tr('Add a habit')}</button><button class="btn" data-action="new-task" data-due="${d}">${tr('Add task')}</button></div></div>`}
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
  </div>`;
}

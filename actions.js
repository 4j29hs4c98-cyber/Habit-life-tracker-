// actions.js
import * as db from './db.js';
import * as sync from './sync.js';
import * as push from './push.js';
import { reviewPdf } from './pdf.js';
import * as att from './attach.js';
import { tr, LOC } from './i18n.js';
import { allHabits, celebrate, dayStats, $, BUILTIN_AREAS, S, STARTER, STARTER_WEEKLY, addDays, areaInfo, closeModal, esc, get, habits, isDone, isMini, list, logId, mondayOf, monthKey, openModal, remove, save, toast, today, uid, ymd } from './core.js';
import { UNITS, areaForm, areasModal, editWorkout, finishAtt, habitForm, passwordForm, projectForm, refreshAtt, simpleForm, taskForm } from './forms.js';
import { applyLang, applyTheme, closeFab, render } from './render.js';
import { refreshPush, saveNotify } from './views/settings.js';
import { monthPdfData, yearPdfData } from './views/stats.js';
import { PLAN_ID, dayHasContent, hasPlan, planData, workoutFor } from './views/train.js';
import { shownWeek } from './views/habits.js';

/* ---------- actions ---------- */
export const nextOrder = kind => Math.max(0, ...list(kind).map(r => r.data.order ?? 0)) + 1;

// Delete (or overwrite) right away, then offer "Undo" for 5 seconds.
// ids: every record the step changes. Undo writes them back (records that didn't exist are removed again).
// later(): work that can't be undone (deleting files), done only when the 5 seconds are over.
export async function undoable(msg, ids, work, later) {
  const before = [...new Set(ids)].map(id => { const r = S.recs.get(id); return { id, rec: r && !r.deleted ? structuredClone(r) : null }; });
  await work();
  render();
  toast(msg, {
    action: 'Undo', duration: 5000,
    onAction: async () => {
      for (const b of before) { if (b.rec) await save(b.rec.kind, b.id, b.rec.data); else await remove(b.id); }
      render();
      if ($('#modal').open && $('.areas-modal')) areasModal();
      toast('Restored');
    },
    onTimeout: later,
  });
}

export const actions = {
  // mode "full": tap on Today · "mini": the Mini button · "cycle": grid cell (empty → done → mini → empty)
  async toggle({ h, d, mode }) {
    const hab = get(h);
    if (hab && hab.data.start && d < hab.data.start) await save('habit', h, { ...hab.data, start: d });
    const cur = isDone(h, d) ? (isMini(h, d) ? 'mini' : 'full') : 'none';
    let next;
    if (mode === 'mini') next = cur === 'mini' ? 'none' : 'mini';
    else if (mode === 'cycle') next = cur === 'none' ? 'full' : cur === 'full' && hab?.data.mini ? 'mini' : 'none';
    else next = cur === 'none' ? 'full' : 'none';
    const wasPerfect = d === today() && dayStats(d).all;
    await save('habit_log', logId(h, d), { habitId: h, date: d, done: next !== 'none', level: next === 'none' ? '' : next });
    render();
    if (d === today() && !wasPerfect && dayStats(d).all) celebrate();
  },
  'new-habit': () => habitForm(null),
  'edit-habit': ({ id }) => habitForm(get(id)),
  async 'archive-habit'({ id }) {
    const h = get(id);
    closeModal();
    await undoable(tr('"{name}" archived', { name: h.data.name }), [id], () => save('habit', id, { ...h.data, archived: true, archivedAt: today() }));
  },
  async 'restore-habit'({ id }) { // the archived period is kept as a pause, so it doesn't count as missed days
    const h = get(id), from = h.data.archivedAt, to = ymd(addDays(new Date(), -1));
    const pauses = [...(h.data.pauses || [])];
    if (from && from <= to) pauses.push([from, to]);
    const { archived, archivedAt, ...rest } = h.data;
    await save('habit', id, { ...rest, pauses });
    closeModal(); render(); toast(tr('"{name}" restored', { name: h.data.name }));
  },
  async 'del-habit'({ id }) {
    const logs = list('habit_log').filter(r => r.data.habitId === id).map(r => r.id);
    closeModal();
    await undoable('Habit deleted', [id, ...logs], async () => { await remove(id); for (const l of logs) await remove(l); });
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
  month({ dir }) { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + +dir, 1); S.gridWeek = null; render(); },
  'grid-mode'({ v }) { S.gridMode = v; render(); },
  fab(_, el) {
    const m = $('#fab-menu'), open = m.hidden;
    if (open) {
      m.innerHTML = [['fab-habit', 'New habit', '◇'], ['fab-task', 'New task', '✓'], ['fab-workout', 'New workout', '↗']]
        .map(([a2, l]) => `<button role="menuitem" data-action="${a2}">${tr(l)}</button>`).join('');
      m.hidden = false; el.setAttribute('aria-expanded', 'true'); m.querySelector('button')?.focus();
    } else { m.hidden = true; el.setAttribute('aria-expanded', 'false'); }
  },
  'fab-habit'() { closeFab(); habitForm(null); },
  'fab-task'() { closeFab(); taskForm(null, today()); },
  async 'fab-workout'() { // today's training card with a new exercise row, ready to type
    closeFab();
    S.week = mondayOf(new Date());
    if (location.hash !== '#train') { location.hash = '#train'; await new Promise(r => setTimeout(r, 60)); }
    await actions['add-row']({ w: today(), list: 'exercises' });
  },
  'grid-week'({ dir }) { // the shown month follows the week (the month that holds its Thursday)
    S.gridWeek = addDays(shownWeek(), 7 * +dir);
    const thu = addDays(S.gridWeek, 3);
    S.month = new Date(thu.getFullYear(), thu.getMonth(), 1);
    render();
  },
  week({ dir }) { S.week = addDays(S.week, 7 * +dir); render(); },
  'new-weekly': () => simpleForm('weekly', 'New weekly habit', 'Name'),
  'edit-weekly': ({ id }) => simpleForm('weekly', 'Edit weekly habit', 'Name', get(id).data.name, id, 'del-weekly'),
  async 'del-weekly'({ id }) { closeModal(); await undoable('Weekly habit deleted', [id], () => remove(id)); },
  async 'toggle-week'({ id, w }) {
    const r = get(id), weeks = { ...(r.data.weeks || {}) };
    if (weeks[w]) delete weeks[w]; else weeks[w] = true;
    await save('weekly_habit', id, { ...r.data, weeks });
    render();
  },
  'new-goal': () => simpleForm('goal', tr('New goal for {month}', { month: S.month.toLocaleDateString(LOC(), { month: 'long' }) }), 'Goal'),
  async 'toggle-goal'({ id }) { const g = get(id); await save('goal', id, { ...g.data, done: !g.data.done }); render(); },
  async 'del-goal'({ id }) { await undoable('Goal deleted', [id], () => remove(id)); },
  'task-tab': ({ tab }) => { S.taskTab = tab; render(); },
  'new-task': ({ due }) => taskForm(null, due),
  'edit-task': ({ id }) => taskForm(get(id)),
  async 'toggle-task'({ id }) { const x = get(id); await save('task', id, { ...x.data, done: !x.data.done, doneAt: x.data.done ? '' : today() }); render(); if (!x.data.done) toast('Task done'); },
  async 'del-task'({ id }) {
    const files = [...(get(id)?.data.attachments || []), ...(S.att?.added || [])].filter(a2 => a2.type === 'file').map(a2 => a2.path);
    if (S.att) S.att.saved = true;
    closeModal();
    await undoable('Task deleted', [id], () => remove(id), () => att.removeFiles(files));
  },
  'new-project': () => projectForm(null),
  'edit-project': ({ id }) => projectForm(get(id)),
  async 'del-project'({ id }) {
    const files = [...(get(id)?.data.attachments || []), ...(S.att?.added || [])].filter(a2 => a2.type === 'file').map(a2 => a2.path);
    if (S.att) S.att.saved = true;
    const tasks = list('task').filter(x => x.data.projectId === id);
    closeModal();
    await undoable('Project deleted', [id, ...tasks.map(t => t.id)], async () => {
      await remove(id);
      for (const t of tasks) await save('task', t.id, { ...t.data, projectId: '' }); // tasks stay, without a project
    }, () => att.removeFiles(files));
  },
  async 'add-row'({ w, list: l }) {
    await editWorkout(w, x => x[l].push(l === 'cardio' ? { name: '', time: '', speed: '', distance: '', done: false } : { name: '', weight: '', sets: 3, reps: 10, rest: tr('1 min'), done: false }));
    render();
    const inputs = document.querySelectorAll(`input[data-w="${w}"][data-list="${l}"][data-k="name"]`);
    inputs[inputs.length - 1]?.focus();
  },
  async 'tick-ex'({ w, list: l, i }) { // tick an exercise from the Today page (starts today's entry from the plan if needed)
    await editWorkout(w, x => { if (x[l][+i]) x[l][+i].done = !x[l][+i].done; });
    render();
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
    await undoable('Weekly plan saved', [PLAN_ID], () => save('setting', PLAN_ID, { ...(planData() || {}), days, since: planData()?.since || ymd(mondayOf(new Date())) }));
  },
  async 'plan-clear'() {
    await undoable('Weekly plan deleted', [PLAN_ID], () => remove(PLAN_ID));
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
    const a = areaInfo(id), inArea = allHabits().filter(h => h.data.area === id);
    const recId = BUILTIN_AREAS[id] ? 'area_' + id : id;
    areasModal();
    await undoable(tr('"{name}" deleted', { name: a.label }), [recId, ...inArea.map(h => h.id)], async () => {
      for (const h of inArea) await save('habit', h.id, { ...h.data, area: '' }); // habits stay, without an area
      if (BUILTIN_AREAS[id]) await save('area', recId, { ...(get(recId)?.data || {}), hidden: true, custom: false });
      else await remove(id);
    });
    if ($('#modal').open && $('.areas-modal')) areasModal();
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
  'delete-account'() {
    const word = tr('DELETE');
    openModal(`<form data-form="delete-account">
      <h2>${tr('Delete account')}</h2>
      <p class="note">${tr('Everything in the cloud and on this device will be deleted. Type {word} to confirm.', { word: `<b>${word}</b>` })}</p>
      <label>${tr('Confirmation')}<input name="confirm" autocomplete="off" required placeholder="${word}"></label>
      <div class="row end"><button type="button" class="btn" data-action="close">${tr('Cancel')}</button><button class="btn danger">${tr('Delete for good')}</button></div></form>`);
  },
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

export const forms = {
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
    let freq = fd.get('freq') || 'daily';
    const days = fd.getAll('days').map(Number).sort();
    if (freq === 'days' && (!days.length || days.length === 7)) freq = 'daily';
    const unitIn = (fd.get('unit') || '').trim();
    const unit = UNITS.find(u => tr(u).toLowerCase() === unitIn.toLowerCase() || u === unitIn.toLowerCase()) || unitIn;
    const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return n > 0 ? n : ''; };
    await save('habit', id || uid(), { ...(old?.data || { order: nextOrder('habit'), start: today() }), name: fd.get('name').trim(), area: fd.get('area'),
      freq, days: freq === 'days' ? days : [], perWeek: freq === 'weekly' ? +fd.get('perWeek') || 3 : '', target: num(fd.get('target')), unit: num(fd.get('target')) || num(fd.get('mini')) ? unit : '', mini: num(fd.get('mini')) });
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
  async 'delete-account'(fd) {
    if ((fd.get('confirm') || '').trim().toUpperCase() !== tr('DELETE').toUpperCase()) throw new Error(tr('Type {word} to confirm.', { word: tr('DELETE') }));
    if (!navigator.onLine) throw new Error('No connection. Try again when you are online.');
    try { await push.disable(); } catch {}
    const { data, error } = await sync.getClient().functions.invoke('account', { body: { action: 'delete' } });
    if (error || data?.error) throw new Error(data?.error || error.message);
    try { await sync.signOut(); } catch {}
    await db.clearAll(); S.recs.clear();
    try { ['lastSync', 'googleCache'].forEach(k => localStorage.removeItem(k)); } catch {}
    toast('Your account was deleted');
    location.hash = '#today';
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

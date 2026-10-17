// forms.js
import * as sync from './sync.js';
import * as att from './attach.js';
import { tr, LOC } from './i18n.js';
import { forms } from './actions.js';
import { fmtShort, $, AREA_EMOJIS, BUILTIN_AREAS, S, addDays, allAreas, areaOptions, bestStreak, esc, get, habits, list, mondayOf, openModal, projectOptions, save, streak, toast, uid, ymd } from './core.js';
import { PLAN_ID, planCopy, planData } from './views/train.js';

/* ---------- forms in modal ---------- */
export const UNITS = ['minutes', 'pages', 'times', 'km', 'glasses', 'liters', 'steps'];
export function scheduleFields(h) {
  const d = h?.data || {}, f = d.freq || 'daily', days = d.days || [0, 1, 2, 3, 4, 5, 6];
  const custom = f !== 'daily' || d.target || d.mini;
  const names = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'narrow' }));
  const summary = [f === 'days' ? days.map(i => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'short' })).join(', ') : f === 'weekly' ? tr('{n}× per week', { n: d.perWeek || 3 }) : tr('Every day'),
    d.target ? `${d.target} ${tr(d.unit || '')}`.trim() : ''].filter(Boolean).join(' · ');
  return `<details class="sched" ${custom ? 'open' : ''}>
    <summary>${tr('Schedule & target')}<span class="muted">${esc(summary)}</span></summary>
    <div class="sched-body" data-freq="${f}">
      <div class="field">${tr('How often')}
        <div class="seg3" role="radiogroup">${[['daily', 'Every day'], ['days', 'Specific days'], ['weekly', '× per week']].map(([v, l]) => `<label><input type="radio" name="freq" value="${v}" ${f === v ? 'checked' : ''} class="sr"><span>${tr(l)}</span></label>`).join('')}</div>
      </div>
      <div class="days7 only-days">${names.map((n, i) => `<label><input type="checkbox" name="days" value="${i}" ${days.includes(i) ? 'checked' : ''} class="sr"><span>${n}</span></label>`).join('')}</div>
      <label class="field only-weekly">${tr('Times per week')}<select name="perWeek">${[1, 2, 3, 4, 5, 6].map(n => `<option ${+(d.perWeek || 3) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="hintbox only-days">${tr('Only the chosen days count. Other days don\'t lower your score.')}</p>
      <p class="hintbox only-weekly">${tr('Check it off on any days. The week counts once you reach the number.')}</p>
      <div class="two">
        <label class="field">${tr('Target (optional)')}<input name="target" type="number" inputmode="decimal" min="0" step="any" value="${esc(d.target || '')}" placeholder="15"></label>
        <label class="field">${tr('Unit')}<input name="unit" list="unit-list" value="${esc(d.unit ? tr(d.unit) : '')}" placeholder="${tr('minutes')}"></label>
      </div>
      <label class="field">${tr('Mini version (optional)')}<input name="mini" type="number" inputmode="decimal" min="0" step="any" value="${esc(d.mini || '')}" placeholder="5"></label>
      <p class="hintbox">${tr('For busy days: a mini version keeps your streak going and counts as half in your stats.')}</p>
      <datalist id="unit-list">${UNITS.map(u => `<option value="${tr(u)}">`).join('')}</datalist>
    </div>
  </details>`;
}
export function habitForm(h, preset) {
  openModal(`<form data-form="habit" data-id="${h ? h.id : ''}">
    <h2>${tr(h ? 'Edit habit' : 'New habit')}</h2>
    <label>${tr("Name")}<input name="name" required value="${esc(preset?.name ?? h?.data.name ?? '')}" placeholder="${tr("e.g. Drink 2 L of water")}"></label>
    ${scheduleFields(h)}
    <label>${tr("Area")}<select name="area">${areaOptions(preset?.area ?? h?.data.area ?? (allAreas()[0]?.id || ''))}</select></label>
    <button type="button" class="link small-link" data-action="new-area" data-from="habit">${tr('+ New area')}</button>
    ${h ? `<p class="note">${tr('Best streak: {best} days. Current: {cur} days.', { best: bestStreak(h.id), cur: streak(h.id) })}</p>` : ''}
    ${h?.data.archived ? `<p class="note">${tr('Archived on {date}. It doesn\'t show on Today or in the grids, but its history stays in your stats.', { date: fmtShort(h.data.archivedAt) })}</p>` : ''}
    <div class="row end">${h ? `<button type="button" class="btn danger" data-action="del-habit" data-id="${h.id}">${tr("Delete")}</button>
      ${h.data.archived ? `<button type="button" class="btn" data-action="restore-habit" data-id="${h.id}">${tr('Restore')}</button>` : `<button type="button" class="btn" data-action="archive-habit" data-id="${h.id}">${tr('Archive')}</button>`}` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
export function simpleForm(form, title, field, value, id, delAction) {
  openModal(`<form data-form="${form}" data-id="${id || ''}">
    <h2>${tr(title)}</h2>
    <label>${tr(field)}<input name="name" required value="${esc(value || '')}"></label>
    <div class="row end">${id && delAction ? `<button type="button" class="btn danger" data-action="${delAction}" data-id="${id}">${tr("Delete")}</button>` : ''}
      <button type="button" class="btn" data-action="close">${tr("Cancel")}</button><button class="btn primary">${tr("Save")}</button></div></form>`);
}
export function taskForm(x, due) {
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
export function projectForm(p) {
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
export function startAtt(rec) {
  S.att = { ownerId: rec?.id || uid(), list: structuredClone(rec?.data.attachments || []), added: [], removed: [], saved: false };
}
export function attItems() {
  if (!S.att?.list.length) return `<li class="att-empty muted">${tr('Nothing attached yet.')}</li>`;
  return S.att.list.map((a2, i) => `<li>
    <button type="button" class="att-open" data-action="att-open" data-i="${i}">
      <span class="ico" aria-hidden="true">${a2.type === 'link' ? '🔗' : att.fileIcon(a2)}</span>
      <span class="att-text"><span class="label">${esc(a2.title)}</span><small class="muted">${a2.type === 'link' ? esc(new URL(a2.url).hostname.replace(/^www\./, '')) : att.sizeText(a2.size)}</small></span>
    </button>
    <button type="button" class="icon-btn quiet" data-action="att-del" data-i="${i}" aria-label="${tr('Remove')}">×</button></li>`).join('');
}
export function attSection() {
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
export const refreshAtt = () => { const el = $('#att-list'); if (el) el.innerHTML = attItems(); };
export async function attUpload(files) {
  for (const f of files) {
    toast(tr('Uploading {name}…', { name: f.name }));
    try { const a2 = await att.upload(S.att.ownerId, f); S.att.list.push(a2); S.att.added.push(a2); refreshAtt(); toast('Document added'); }
    catch (e) { toast(e.message); }
  }
}
export function finishAtt() { // called when a form is saved
  if (!S.att) return null;
  S.att.saved = true;
  att.removeFiles(S.att.removed.map(a2 => a2.path));
  const list = S.att.list;
  return list;
}

export function areasModal() {
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
export function areaForm(a) {
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
export async function editWorkout(d, fn) {
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

export function passwordForm(fromReset) {
  openModal(`<form data-form="password">
    <h2>${tr(fromReset ? 'Choose a new password' : 'Change password')}</h2>
    ${fromReset ? `<p class="note">${tr("You're signed in through the reset link. Set a new password to finish.")}</p>` : ''}
    <label>${tr("New password")}<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>${tr("Repeat new password")}<input name="again" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="row end"><button type="button" class="btn" data-action="close">${tr(fromReset ? 'Later' : 'Cancel')}</button><button class="btn primary">${tr("Save password")}</button></div></form>`);
}

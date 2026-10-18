// views/settings.js
import * as db from '../db.js';
import * as sync from '../sync.js';
import * as push from '../push.js';
import { tr, getLang } from '../i18n.js';
import { archivedHabits, areaInfo, esc, fmtShort, $, S, agoText, get, habits, save, today } from '../core.js';
import { softRender } from '../render.js';
import { reviewsSection } from './stats.js';
import * as jc from '../crypto.js';
import { journalEnabled, journalSettings } from './journal.js';
import { heroOn, heroPreview } from '../heroimg.js';

export function syncLine() {
  const st = sync.status, pend = [...S.recs.values()].filter(r => !r.synced).length;
  const map = { syncing: tr('Syncing…'), offline: tr('Offline. Changes sync when you are back online.'), error: tr('Sync failed: {msg}', { msg: esc(st.error || '') }), idle: st.last ? tr('Synced {ago}', { ago: agoText(st.last) }) : tr('Ready to sync') };
  return `${map[st.state] || ''}${pend && st.state !== 'syncing' ? ' ' + tr(pend === 1 ? '{n} change waiting.' : '{n} changes waiting.', { n: pend }) : ''}`;
}
export function accountSection() {
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
export const NOTIFY_DEFAULTS = { enabled: false, tz: 'Europe/Berlin', morning: { on: true, time: '07:30' }, training: { on: true, time: '17:00' }, evening: { on: true, time: '20:00' } };
export const notifySettings = () => ({ ...NOTIFY_DEFAULTS, ...(get('setting_notifications')?.data || {}) });
export async function saveNotify(patch) {
  const cur = notifySettings();
  await save('setting', 'setting_notifications', { ...cur, ...patch, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || cur.tz });
}
export async function refreshPush() {
  S.push.perm = push.permission();
  try { S.push.sub = !!(await push.currentSubscription()); } catch { S.push.sub = false; }
  if (S.view === 'more') softRender();
}
export function notifySection() {
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

function journalSection() {
  const on = journalEnabled(), set = !!journalSettings(), open = jc.isUnlocked();
  return `<section class="panel"><h2>${tr('Journal')}</h2>
    <div class="seg" role="radiogroup" aria-label="${tr('Journal')}">${[['1', 'On'], ['0', 'Off']].map(([v, l]) => `<button role="radio" aria-checked="${(v === '1') === on}" data-action="journal-toggle" data-v="${v}">${tr(l)}</button>`).join('')}</div>
    <p class="note">${tr('Entries are encrypted on this device with your journal passphrase. Nobody else can read them, not even with access to the database.')}</p>
    ${on && set ? `<div class="row">${open ? `<button class="btn" data-action="journal-lock">🔒 ${tr('Lock journal')}</button>` : `<a class="btn" href="#journal">${tr('Open journal')}</a>`}
      <button class="btn" data-action="journal-change">${tr('Change passphrase')}</button>
      ${open ? `<button class="btn" data-action="journal-export-text">${tr('Export journal as text')}</button>` : ''}</div>
      <p class="note">${tr('Backups (Export backup) keep journal entries encrypted.')}</p>` : ''}
  </section>`;
}
function heroSection() {
  const on = heroOn(), img = heroPreview();
  return `<section class="panel"><h2>${tr('Header image')}</h2>
    <div class="seg" role="radiogroup" aria-label="${tr('Header image')}">${[['1', 'On'], ['0', 'Off']].map(([v, l]) => `<button role="radio" aria-checked="${(v === '1') === on}" data-action="hero-toggle" data-v="${v}">${tr(l)}</button>`).join('')}</div>
    ${on ? `<div class="hero-pick">${img ? `<img src="${img}" alt="${tr('Current header image')}">` : ''}
      <div class="row"><label class="btn">${tr(img ? 'Choose another photo' : 'Choose a photo')}<input type="file" id="hero-file" accept="image/*" hidden></label>${img ? `<button class="btn danger" data-action="hero-remove">${tr('Remove')}</button>` : ''}</div>
      <p class="note">${tr('Shown softly behind the Today header. It is stored privately with your account.')}</p></div>` : ''}
  </section>`;
}
function archivedSection() {
  const list2 = archivedHabits();
  return `<section class="panel"><h2>${tr('Archived habits')}</h2>
    ${list2.length ? `<ul class="archive-list">${list2.map(h => `<li>
      <button class="arch-name" data-action="edit-habit" data-id="${h.id}"><span aria-hidden="true">${esc(areaInfo(h.data.area).icon)}</span><span class="label">${esc(h.data.name)}</span><small class="muted">${tr('since {date}', { date: fmtShort(h.data.archivedAt) })}</small></button>
      <button class="btn small" data-action="restore-habit" data-id="${h.id}">${tr('Restore')}</button></li>`).join('')}</ul>`
    : `<p class="note">${tr('Habits you archive show up here. Their history stays in your stats.')}</p>`}
  </section>`;
}

export function viewMore() {
  let theme = 'system';
  try { theme = localStorage.getItem('theme') || 'system'; } catch {}
  const count = [...S.recs.values()].filter(r => !r.deleted).length;
  return `
  <header class="page-head"><h1>${tr("Settings")}</h1></header>
  ${db.isMemoryOnly() ? `<p class="warn">${tr("This browser blocked local storage, so changes are lost when you close the app. Open it in a normal (not private) window.")}</p>` : ''}
  <section class="panel">
    <h2>${tr("Appearance")}</h2>
    <div class="seg" role="radiogroup" aria-label="${tr("Theme")}">${['system', 'light', 'dark'].map(v => `<button role="radio" aria-checked="${v === theme}" data-action="theme" data-v="${v}">${tr(v[0].toUpperCase() + v.slice(1))}</button>`).join('')}</div>
    <h2 class="sub-h">${tr('Your name')}</h2>
    <label class="field name-field"><span class="sr">${tr('Your name')}</span><input id="pref-name" autocomplete="given-name" maxlength="40" value="${esc(get('setting_prefs')?.data?.name || '')}" placeholder="${tr('For the greeting on Today')}"></label>
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
  ${journalSection()}
  ${heroSection()}
  ${archivedSection()}
  ${sync.status.user ? `<section class="panel danger-zone"><h2>${tr('Delete account')}</h2>
    <p class="note">${tr('Deletes your account and everything stored in the cloud: habits, tasks, workouts, documents and notification settings, on all devices. This can\'t be undone.')}</p>
    <p class="hintbox">${tr('Tip: export a backup first. You can import it again later.')}</p>
    <div class="row"><button class="btn" data-action="export">${tr('Export backup')}</button><button class="btn danger" data-action="delete-account">${tr('Delete account…')}</button></div></section>` : ''}
  ${S.installPrompt ? `<section class="panel"><h2>${tr("Install")}</h2><p class="note">${tr("Add the app to your home screen or dock.")}</p><button class="btn primary" data-action="install">${tr("Install app")}</button></section>` : ''}`;
}

// Entry point: wires up events, routing, sync and startup.
import * as db from './db.js';
import * as sync from './sync.js';
import { tr } from './i18n.js';
import { actions, forms } from './actions.js';
import { $, S, VIEWS, closeModal, list, migrateWeekly, mondayOf, toast, today } from './core.js';
import { attUpload, editWorkout, passwordForm } from './forms.js';
import { applyLang, applyTheme, closeFab, initRenderWiring, render, softRender } from './render.js';
import { notifySettings, refreshPush, saveNotify, syncLine } from './views/settings.js';

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  if (!e.target.closest('#fab')) closeFab(); // tap outside closes the + menu
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
  if (el.name === 'freq') { el.closest('.sched-body').dataset.freq = el.value; return; }
  if (el.id === 'att-file' && el.files.length) { const files = [...el.files]; el.value = ''; return attUpload(files); }
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

function route() {
  const v = location.hash.slice(1);
  if (v.startsWith('progress/')) { S.exercise = decodeURIComponent(v.slice(9)); S.view = 'progress'; render(); return; }
  if (v === 'progress') S.exercise = '';
  if (v === 'tasks/new') { // quick action from the app icon
    S.view = 'tasks'; S.taskTab = 'today';
    history.replaceState(null, '', '#tasks');
    render();
    setTimeout(() => $('#qt')?.focus(), 60);
    return;
  }
  if (v === 'stats') { history.replaceState(null, '', '#' + (S.statsTab || 'month')); S.view = S.statsTab || 'month'; render(); return; }
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

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFab(); });
document.addEventListener('keydown', e => { // Enter in the link field adds the link instead of saving the form
  if (e.key === 'Enter' && (e.target.id === 'att-url' || e.target.id === 'att-title')) { e.preventDefault(); actions['att-add-link'](); }
});

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

/* ---------- start ---------- */
(async function start() {
  applyTheme();
  initRenderWiring();
  await db.open();
  (await db.loadAll()).forEach(r => S.recs.set(r.id, r));
  applyLang();
  await migrateWeekly();
  route();
  await sync.init(syncHooks);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

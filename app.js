// Entry point: wires up events, routing, sync and startup.
import * as db from './db.js';
import * as sync from './sync.js';
import { tr } from './i18n.js';
import { actions, forms } from './actions.js';
import { $, S, VIEWS, closeModal, list, migrateWeekly, mondayOf, toast, today, get, save } from './core.js';
import { attUpload, editWorkout, passwordForm } from './forms.js';
import { applyLang, applyTheme, closeFab, initRenderWiring, render, softRender } from './render.js';
import { notifySettings, refreshPush, saveNotify, syncLine } from './views/settings.js';
import * as jc from './crypto.js';
import { J } from './views/journal.js';
import { pickHeroImage, setHeroReady } from './heroimg.js';

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
  try { res = await fn(new FormData(f), f.dataset.id, f); }
  catch (err) { toast(err.message || 'Something went wrong. Try again.'); return; }
  if (res !== 'keep' && $('#modal').open) closeModal();
  render();
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'import-file' && el.files[0]) return importFile(el.files[0]);
  if (el.id === 'hero-file' && el.files[0]) { try { await pickHeroImage(el.files[0]); toast('Header image saved'); } catch (e) { toast(e.message); } el.value = ''; render(); return; }
  if (el.id === 'pref-name') { await save('setting', 'setting_prefs', { ...(get('setting_prefs')?.data || {}), name: el.value.trim() }); return; }
  if (el.name === 'freq') { el.closest('.sched-body').dataset.freq = el.value; return; }
  if (el.id === 'att-file' && el.files.length) { const files = [...el.files]; el.value = ''; return attUpload(files); }
  if (el.dataset.notif) {
    const k = el.dataset.notif, cur = notifySettings()[k];
    await saveNotify({ [k]: { ...cur, [el.dataset.nk]: el.type === 'checkbox' ? el.checked : (el.value || cur.time) } });
    return;
  }
  const d = el.dataset.w;
  if (!d) return;
  if (el.dataset.k === 'time' && !el.dataset.list) { await editWorkout(d, x => { x.time = el.value; }); return; }
  if (el.dataset.k === 'groups') {
    await editWorkout(d, x => { x.groups = el.value.split(',').map(s => s.trim()).filter(Boolean); });
    return;
  }
  const { list: l, i, k } = el.dataset;
  await editWorkout(d, x => {
    const e = x[l][+i]; if (!e) return;
    e[k] = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'done' && l === 'exercises') e.setsDone = el.checked ? (parseInt(e.sets, 10) || 1) : 0;
    if (k === 'sets' && e.setsDone != null) { e.setsDone = Math.min(+e.setsDone || 0, Math.max(1, parseInt(e.sets, 10) || 1)); e.done = e.setsDone >= Math.max(1, parseInt(e.sets, 10) || 1); }
  });
  if (el.type === 'checkbox' || ['group', 'sets', 'name'].includes(el.dataset.k)) render();
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
// Swipe left/right on a week strip (or the week grid) to change the week.
let swipe = null;
document.addEventListener('touchstart', e => { const el = e.target.closest('[data-swipe]'); swipe = el && e.touches.length === 1 ? { el, x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y, act = actions[swipe.el.dataset.swipe];
  swipe = null;
  if (act && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) act({ dir: dx < 0 ? 1 : -1 });
}, { passive: true });
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
document.addEventListener('input', e => { // keep what you type in the journal while switching questions or moods
  if (e.target.id === 'j-text') { const d = e.target.dataset.d; (S.jDraft[d] ||= {}).text = e.target.value; }
});
document.addEventListener('journal-ready', () => softRender());

(async function start() {
  applyTheme();
  jc.initAutoLock(() => { J.cache.clear(); S.jDraft = {}; if (['journal', 'month', 'today'].includes(S.view)) softRender(); });
  setHeroReady(() => { if (S.view === 'today') softRender(); });
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

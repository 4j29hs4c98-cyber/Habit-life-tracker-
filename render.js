// render.js
import * as sync from './sync.js';
import * as att from './attach.js';
import { tr, setLang, getLang } from './i18n.js';
import { gridMode, resetToastHost, $, S, get, habits, monthKey, today } from './core.js';
import { viewHabits } from './views/habits.js';
import { viewMore } from './views/settings.js';
import { viewMonth, viewProgress, viewReviews, viewYear } from './views/stats.js';
import { viewTasks } from './views/tasks.js';
import { viewToday } from './views/today.js';
import { viewPlan, viewTrain } from './views/train.js';

/* ---------- render ---------- */
// Scrollable areas get a stable key (their section heading + class + position), so a re-render can put
// each one back where it was, even if other areas appear or disappear in between.
function scrollAreas() {
  const seen = {}, out = new Map();
  document.querySelectorAll('#main .grid-scroll, #main .tabs').forEach(el => {
    const head = el.closest('section, .panel')?.querySelector('h1, h2')?.textContent?.trim() || '';
    const base = `${head}|${el.className}`;
    seen[base] = (seen[base] || 0) + 1;
    out.set(`${base}|${seen[base]}`, el);
  });
  return out;
}
// What identifies the focused control across re-renders (the same button or field in the new page).
const FOCUS_KEYS = ['action', 'h', 'd', 'id', 'w', 'list', 'i', 'k', 'v', 'tab', 'm', 'y', 'dir'];
function focusSignature(el) {
  if (!el || el === document.body || !$('#main').contains(el)) return null;
  const sig = { tag: el.tagName, elId: el.id || '', name: el.getAttribute('name') || '' };
  FOCUS_KEYS.forEach(k => { if (el.dataset[k] != null) sig[k] = el.dataset[k]; });
  if ('selectionStart' in el) { try { sig.sel = [el.selectionStart, el.selectionEnd]; } catch {} }
  return sig;
}
function findBySignature(sig) {
  if (!sig) return null;
  if (sig.elId) return document.getElementById(sig.elId);
  return [...$('#main').querySelectorAll(sig.tag)].find(el => (sig.name ? el.getAttribute('name') === sig.name : true)
    && FOCUS_KEYS.every(k => (el.dataset[k] ?? undefined) === sig[k])) || null;
}

export function render() {
  const main = $('#main');
  const keepScroll = render.lastView === S.view;
  const scroll = window.scrollY;
  const views = { today: viewToday, habits: viewHabits, tasks: viewTasks, train: viewTrain, more: viewMore, plan: viewPlan, year: () => statsWrap('year', viewYear()), month: () => statsWrap('month', viewMonth()), progress: () => statsWrap('progress', viewProgress()), reviews: () => statsWrap('reviews', viewReviews()) };
  const saved = new Map(), focus = keepScroll ? focusSignature(document.activeElement) : null;
  if (keepScroll) scrollAreas().forEach((el, k) => saved.set(k, [el.scrollLeft, el.scrollTop]));
  main.style.minHeight = keepScroll ? `${main.offsetHeight}px` : ''; // no collapse while swapping content, so the page can't jump
  main.innerHTML = views[S.view]();
  const restore = () => {
    scrollAreas().forEach((el, k) => { const v = saved.get(k); if (v) { el.scrollLeft = v[0]; el.scrollTop = v[1]; } });
    if (keepScroll && Math.abs(window.scrollY - scroll) > 1) window.scrollTo(0, scroll);
  };
  const navView = { plan: 'train', year: 'stats', month: 'stats', progress: 'stats', reviews: 'stats' }[S.view] || S.view;
  placeGear();
  updateFab();
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === navView ? 'page' : 'false'));
  if (keepScroll) restore(); else window.scrollTo(0, 0);
  main.style.minHeight = '';
  if (keepScroll) requestAnimationFrame(restore); // once more after the browser has laid out images and fonts
  if (focus) {
    const el = findBySignature(focus);
    if (el) {
      el.focus({ preventScroll: true });
      if (focus.sel && 'setSelectionRange' in el) { try { el.setSelectionRange(...focus.sel); } catch {} }
    }
  }
  if (S.view === 'habits' && (!keepScroll || render.lastMonth !== monthKey(S.month) || render.lastGrid !== gridMode())) { // show today in the month grid
    const g = $('.habit-grid:not(.weekly) .is-today'), box = g?.closest('.grid-scroll');
    if (box) {
      const nameW = $('.habit-grid .hname')?.offsetWidth || 0;
      box.scrollLeft = Math.max(0, g.offsetLeft - nameW - (box.clientWidth - nameW) * 0.6);
    }
  }
  render.lastMonth = monthKey(S.month);
  render.lastGrid = gridMode();
  if (S.view === 'train' && !keepScroll) $('.day.is-today')?.scrollIntoView({ block: 'start' });
  render.lastView = S.view;
}

// Settings live behind a gear icon in the top corner of each page header (with the sync status dot).
let gearEl = null;
function placeGear() {
  if (!gearEl) {
    gearEl = document.createElement('a');
    gearEl.className = 'gear'; gearEl.href = '#more'; gearEl.id = 'gear';
    gearEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span id="sync-dot" class="sync-dot" data-state="off" aria-hidden="true"></span>';
  }
  gearEl.setAttribute('aria-label', tr('Settings'));
  gearEl.setAttribute('aria-current', S.view === 'more' ? 'page' : 'false');
  const head = $('#main .page-head');
  if (head) head.appendChild(gearEl); else $('#main').prepend(gearEl);
}
// The "+" button: on the five main screens only.
export function updateFab() {
  const fab = $('#fab');
  if (!fab) return;
  fab.hidden = S.view === 'more';
  closeFab();
}
export function closeFab() {
  const m = $('#fab-menu'), b = $('#fab .fab-btn');
  if (m) m.hidden = true;
  b?.setAttribute('aria-expanded', 'false');
}
// Stats: one place for the month review, year overview, training progress and all reviews.
const STATS_TABS = [['month', 'Month'], ['year', 'Year'], ['progress', 'Training'], ['reviews', 'All reviews']];
function statsWrap(tab, html) {
  S.statsTab = tab;
  return `<nav class="tabs stats-tabs" aria-label="${tr('Stats')}">${STATS_TABS.map(([k, l]) => `<a href="#${k}" role="tab" aria-selected="${k === tab}">${tr(l)}</a>`).join('')}</nav>${html}`;
}

export function applyLang(v) {
  let l = v || get('setting_prefs')?.data?.lang;
  if (!l) { try { l = localStorage.getItem('lang'); } catch {} }
  if (!l) l = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  setLang(l);
  try { localStorage.setItem('lang', getLang()); } catch {}
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', tr(el.dataset.i18nLabel)));
}

export function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem('theme') || 'system'; } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- sync wiring ---------- */
export const userIsEditing = () => $('#modal').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
export let renderPending = false;
export function softRender() { if (userIsEditing()) renderPending = true; else render(); }
export function initRenderWiring() {
document.addEventListener('focusout', () => setTimeout(() => { if (renderPending && !userIsEditing()) { renderPending = false; render(); } }, 50));
$('#modal').addEventListener('close', () => {
  if (S.att && !S.att.saved) att.removeFiles(S.att.added.map(a2 => a2.path)); // cancelled: undo new uploads
  S.att = null;
  resetToastHost();
  if (renderPending) { renderPending = false; render(); }
});
}

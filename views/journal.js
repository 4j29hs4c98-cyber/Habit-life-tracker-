// views/journal.js
// The journal: one short entry per day, encrypted on this device before it is stored or synced.
import { tr, LOC } from '../i18n.js';
import * as jc from '../crypto.js';
import { S, addDays, esc, get, list, parse, today, ymd, mondayOf } from '../core.js';

export const JOURNAL_SETTINGS_ID = 'setting_journal_crypto';
export const journalEnabled = () => get('setting_prefs')?.data?.journal !== false;
export const journalSettings = () => get(JOURNAL_SETTINGS_ID)?.data || null;
export const entryId = d => `journal_${d}`;
export const hasEntry = d => !!get(entryId(d));
export const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
export const QUESTIONS = [
  'What went well today?',
  'What will you do differently tomorrow?',
  'What are you grateful for today?',
  'What made you smile today?',
  'What was the hardest part of your day?',
  'What did you learn today?',
  'Who made your day better, and how?',
  'What drained your energy today?',
  'What gave you energy today?',
  'What are you proud of today?',
  'What would make tomorrow a good day?',
  'Which habit felt easiest today, and why?',
  'What got in the way of your plans today?',
  'How did you take care of yourself today?',
  'What is one thing you want to remember about today?',
  'What worried you today, and how much does it matter?',
  'What small win did you have today?',
  'What did your body need today?',
  'If today had a title, what would it be?',
  'What are you looking forward to?',
];
export const questionIndex = (d, offset = 0) => (Number(d.replaceAll('-', '')) * 7 + offset) % QUESTIONS.length;

// Decrypted entries, in memory only while the journal is unlocked.
export const J = { cache: new Map() };
export async function decryptAll() {
  if (!jc.isUnlocked()) return;
  for (const r of list('journal')) {
    const c = J.cache.get(r.id);
    if (c && c.updated === r.updated_at) continue;
    try { J.cache.set(r.id, { updated: r.updated_at, entry: await jc.decryptJSON(r.data) }); }
    catch { J.cache.set(r.id, { updated: r.updated_at, error: true }); }
  }
}
export const entryFor = d => J.cache.get(entryId(d))?.entry || null;
export const cacheFresh = () => list('journal').every(r => J.cache.get(r.id)?.updated === r.updated_at);
export const eveningTime = () => get('setting_notifications')?.data?.evening?.time || '20:00';
const nowHM = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

// "Journal" item in Today's plan: from the evening reminder time on today, and on any day with an entry.
export function journalPlanItem(d) {
  if (!journalEnabled()) return null;
  const t = today(), done = hasEntry(d);
  if (!done && !(d === t && nowHM() >= eveningTime())) return null;
  return { kind: 'journal', time: eveningTime(), done, title: tr('Journal'), sub: done ? tr('Entry saved') : tr(QUESTIONS[questionIndex(d)]) };
}
journalPlanItem.enabled = journalEnabled;

// ---------- screens ----------
function setupScreen() {
  return `<section class="panel journal-intro">
    <h2>${tr('Set up your private journal')}</h2>
    <p>${tr('Your entries are locked with a passphrase that only you know. They are encrypted on this device before they are saved or synced, so nobody else can read them, not even with access to the database.')}</p>
    <p class="warn-plain"><strong>${tr('Important:')}</strong> ${tr('If you forget your passphrase and lose your recovery key, your entries are gone for good. Nobody can recover them, not even the app.')}</p>
    <form class="stack" data-form="journal-setup">
      <label>${tr('Passphrase')}<input name="p1" type="password" autocomplete="new-password" minlength="${jc.MIN_PASSPHRASE}" required></label>
      <label>${tr('Repeat passphrase')}<input name="p2" type="password" autocomplete="new-password" minlength="${jc.MIN_PASSPHRASE}" required></label>
      <p class="note">${tr('At least {n} characters. A short sentence is easy to remember and hard to guess.', { n: jc.MIN_PASSPHRASE })}</p>
      <button class="btn primary">${tr('Create journal')}</button>
    </form>
  </section>`;
}
function recoveryScreen(rk) {
  return `<section class="panel journal-intro">
    <h2>${tr('Your recovery key')}</h2>
    <p>${tr('Write this key down and keep it somewhere safe, for example on paper at home. It is shown only now. With it, you can open your journal if you ever forget your passphrase.')}</p>
    <p class="recovery-key" aria-label="${tr('Recovery key')}">${esc(rk)}</p>
    <div class="row"><button class="btn" data-action="copy-recovery">${tr('Copy')}</button></div>
    <label class="check-line"><input type="checkbox" id="rk-ok"> ${tr('I have written down my recovery key.')}</label>
    <button class="btn primary" data-action="recovery-done">${tr('Continue')}</button>
  </section>`;
}
function unlockScreen() {
  if (S.jRecover) return `<section class="panel journal-intro">
    <h2>${tr('Use your recovery key')}</h2>
    <form class="stack" data-form="journal-recover">
      <label>${tr('Recovery key')}<input name="rk" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-…" required></label>
      <label>${tr('New passphrase')}<input name="p1" type="password" autocomplete="new-password" minlength="${jc.MIN_PASSPHRASE}" required></label>
      <label>${tr('Repeat passphrase')}<input name="p2" type="password" autocomplete="new-password" minlength="${jc.MIN_PASSPHRASE}" required></label>
      <div class="row"><button class="btn primary">${tr('Unlock and set passphrase')}</button><button type="button" class="btn" data-action="journal-recover" data-v="0">${tr('Cancel')}</button></div>
    </form></section>`;
  return `<section class="panel journal-intro lock-screen">
    <div class="lock-ico" aria-hidden="true">🔒</div>
    <h2>${tr('Your journal is locked')}</h2>
    <form class="stack" data-form="journal-unlock">
      <label>${tr('Passphrase')}<input name="p" type="password" autocomplete="current-password" required></label>
      <button class="btn primary">${tr('Unlock')}</button>
    </form>
    <button class="link small-link" data-action="journal-recover" data-v="1">${tr('Forgot your passphrase? Use your recovery key')}</button>
  </section>`;
}
function calendar(d) {
  const ref = S.journalMonth ? parse(S.journalMonth + '-01') : new Date(parse(d).getFullYear(), parse(d).getMonth(), 1);
  const y = ref.getFullYear(), m = ref.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const start = mondayOf(first), t = today();
  const cells = [];
  for (let x = new Date(start); x <= last || cells.length % 7; x = addDays(x, 1)) {
    const ds = ymd(x), inMonth = x.getMonth() === m;
    const e = inMonth ? entryFor(ds) : null;
    cells.push(inMonth ? `<button class="jc-day ${hasEntry(ds) ? 'has' : ''} ${ds === d ? 'sel' : ''} ${ds === t ? 'is-today' : ''}" data-action="journal-day" data-d="${ds}" ${ds > t ? 'disabled' : ''} aria-pressed="${ds === d}" aria-label="${x.toLocaleDateString(LOC(), { day: 'numeric', month: 'long' })}${hasEntry(ds) ? ', ' + tr('entry') : ''}"><span>${x.getDate()}</span>${e?.mood ? `<i>${MOODS[e.mood - 1]}</i>` : hasEntry(ds) ? '<b></b>' : ''}</button>` : '<span></span>');
  }
  const wd = [...Array(7)].map((_, i) => addDays(mondayOf(new Date()), i).toLocaleDateString(LOC(), { weekday: 'narrow' }));
  return `<section class="panel j-cal">
    <div class="panel-head"><button class="icon-btn" data-action="journal-month" data-dir="-1" aria-label="${tr('Previous month')}">‹</button><h2>${ref.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' })}</h2><button class="icon-btn" data-action="journal-month" data-dir="1" aria-label="${tr('Next month')}">›</button></div>
    <div class="jc-grid">${wd.map(w => `<span class="jc-wd">${w}</span>`).join('')}${cells.join('')}</div>
  </section>`;
}
function editor(d) {
  const e = entryFor(d), draft = S.jDraft?.[d];
  const free = draft?.free ?? (e ? e.qid == null : !!S.jFree);
  const qi = draft?.qid ?? e?.qid ?? questionIndex(d, S.jqOffset || 0);
  const text = draft?.text ?? e?.text ?? '';
  const mood = draft?.mood ?? e?.mood ?? 0;
  return `<section class="panel j-editor">
    ${free ? `<p class="j-q serif">${tr('Write freely')}</p>` : `<p class="j-q serif">${esc(tr(QUESTIONS[qi]))}</p>`}
    <div class="row j-qbtns">${free ? `<button class="btn small" data-action="journal-free" data-v="0">${tr('Show a question')}</button>` : `<button class="btn small" data-action="journal-q-next">${tr('Another question')}</button><button class="btn small" data-action="journal-free" data-v="1">${tr('Write freely')}</button>`}</div>
    <form class="stack" data-form="journal-entry" data-d="${d}">
      <input type="hidden" name="qid" value="${free ? '' : qi}">
      <label class="sr" for="j-text">${tr('Your entry')}</label>
      <textarea id="j-text" name="text" rows="5" data-d="${d}" placeholder="${tr('A few lines are enough.')}">${esc(text)}</textarea>
      <div class="mood-row" role="radiogroup" aria-label="${tr('Mood (optional)')}"><span class="muted">${tr('Mood (optional)')}</span>${MOODS.map((f, i) => `<button type="button" role="radio" class="mood ${mood === i + 1 ? 'on' : ''}" data-action="journal-mood" data-v="${i + 1}" data-d="${d}" aria-checked="${mood === i + 1}" aria-label="${tr(['Very bad', 'Bad', 'Okay', 'Good', 'Very good'][i])}">${f}</button>`).join('')}</div>
      <input type="hidden" name="mood" value="${mood || ''}">
      <div class="row end"><button class="btn primary">${tr(e ? 'Save changes' : 'Save entry')}</button></div>
    </form>
  </section>`;
}

export function viewJournal() {
  const d = S.journalDay || today(), dt = parse(d);
  const head = `<header class="page-head"><p class="sub">${tr('Journal')}</p><h1>${dt.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' })}</h1></header>`;
  if (!journalEnabled()) return `${head}<section class="panel"><p>${tr('The journal is turned off.')}</p><div class="row"><button class="btn primary" data-action="journal-toggle" data-v="1">${tr('Turn on the journal')}</button></div></section>`;
  if (S.recoveryShow) return head + recoveryScreen(S.recoveryShow);
  if (!journalSettings()) return head + setupScreen();
  if (!jc.isUnlocked()) return head + unlockScreen();
  if (!cacheFresh()) { decryptAll().then(() => document.dispatchEvent(new Event('journal-ready'))); return `${head}<section class="panel"><p class="note">${tr('Decrypting…')}</p></section>`; }
  return `${head}
  <div class="journal-layout">${editor(d)}${calendar(d)}</div>
  <div class="row j-foot"><button class="btn" data-action="journal-lock">🔒 ${tr('Lock journal')}</button></div>`;
}

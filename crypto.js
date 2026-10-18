// crypto.js
// End-to-end encryption for the journal. Everything happens on this device with the Web Crypto API.
//
// How it works:
// - A random 256-bit "journal key" (AES-GCM) encrypts every entry. Each entry gets a new random 12-byte IV.
// - The journal key is stored only in locked form, twice: locked with a key derived from your passphrase,
//   and locked with a key derived from your recovery key (both PBKDF2-SHA-256, 600,000 rounds, random 16-byte salt).
// - The settings record holds the salts, the locked journal key and an encrypted check value. Never the
//   passphrase, the recovery key or any key in readable form.
// - While unlocked, the journal key lives only in memory (as a non-exportable key) and is dropped on lock.

export const ITERATIONS = 600000;
export const MIN_PASSPHRASE = 10;
const CHECK_TEXT = 'habit-life-journal-v1';
const te = new TextEncoder(), td = new TextDecoder();

const toB64 = bytes => { let s = ''; const b = new Uint8Array(bytes); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const random = n => crypto.getRandomValues(new Uint8Array(n));

let key = null;          // CryptoKey (journal key, non-exportable) while unlocked
let lockTimer = null, hiddenAt = 0, onLock = () => {};
export const isUnlocked = () => !!key;
export const AUTO_LOCK_MS = 10 * 60 * 1000;   // 10 minutes without activity
export const BACKGROUND_LOCK_MS = 2 * 60 * 1000; // 2 minutes in the background

async function kekFrom(secret, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, bytes) {
  const iv = random(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes);
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function open(k, box) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, k, fromB64(box.ct)));
}
const importDataKey = (raw, extractable = false) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);

// Recovery key: 128 random bits shown as 8 groups of 4 characters (no 0/O, 1/I/L to avoid mix-ups).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeRecoveryKey() {
  const b = random(32);
  const chars = [...b].map(x => ALPHABET[x % ALPHABET.length]).join('').slice(0, 32);
  return chars.match(/.{4}/g).join('-');
}
export const normalizeRecovery = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,4}/g)?.join('-') || '';

// Lock material for a given raw journal key: what goes into the settings record.
async function lockMaterial(rawKey, passphrase, recoveryKey) {
  const salt = random(16), rsalt = random(16);
  const kek = await kekFrom(passphrase, salt), rkek = await kekFrom(normalizeRecovery(recoveryKey), rsalt);
  return {
    v: 1, alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS,
    salt: toB64(salt), check: await seal(kek, te.encode(CHECK_TEXT)), wrapped: await seal(kek, rawKey),
    rsalt: toB64(rsalt), rwrapped: await seal(rkek, rawKey),
  };
}

// First-time setup: returns { settings, recoveryKey }. Unlocks right away.
export async function setup(passphrase) {
  if ((passphrase || '').length < MIN_PASSPHRASE) throw new Error('passphrase-too-short');
  const raw = random(32), recoveryKey = makeRecoveryKey();
  const settings = { ...(await lockMaterial(raw, passphrase, recoveryKey)), created: new Date().toISOString() };
  key = await importDataKey(raw);
  raw.fill(0);
  touch();
  return { settings, recoveryKey };
}

// Unlock with the passphrase. Throws 'wrong-passphrase' if it doesn't match.
export async function unlock(passphrase, settings) {
  const kek = await kekFrom(passphrase, fromB64(settings.salt), settings.iterations || ITERATIONS);
  let raw;
  try {
    const check = td.decode(await open(kek, settings.check));
    if (check !== CHECK_TEXT) throw new Error();
    raw = await open(kek, settings.wrapped);
  } catch { throw new Error('wrong-passphrase'); }
  key = await importDataKey(raw);
  raw.fill(0);
  touch();
}

// Forgot the passphrase: unlock with the recovery key and choose a new passphrase.
// The journal key stays the same (entries don't change); the recovery key stays valid.
export async function recover(recoveryKey, newPassphrase, settings) {
  if ((newPassphrase || '').length < MIN_PASSPHRASE) throw new Error('passphrase-too-short');
  const rkek = await kekFrom(normalizeRecovery(recoveryKey), fromB64(settings.rsalt), settings.iterations || ITERATIONS);
  let raw;
  try { raw = await open(rkek, settings.rwrapped); } catch { throw new Error('wrong-recovery-key'); }
  const salt = random(16), kek = await kekFrom(newPassphrase, salt);
  const next = { ...settings, salt: toB64(salt), check: await seal(kek, te.encode(CHECK_TEXT)), wrapped: await seal(kek, raw), iterations: ITERATIONS };
  key = await importDataKey(raw);
  raw.fill(0);
  touch();
  return next;
}

// Change the passphrase: a new journal key, every entry re-encrypted, and a new recovery key.
// boxes: [{ id, box }] current entries. Returns { settings, recoveryKey, boxes: [{ id, box }] }.
export async function rekey(currentPassphrase, newPassphrase, settings, boxes) {
  if ((newPassphrase || '').length < MIN_PASSPHRASE) throw new Error('passphrase-too-short');
  await unlock(currentPassphrase, settings); // verifies the current passphrase
  const plain = [];
  for (const b of boxes) plain.push({ id: b.id, bytes: await open(key, b.box) });
  const raw = random(32), recoveryKey = makeRecoveryKey();
  const nextKey = await importDataKey(raw);
  const out = [];
  for (const p of plain) { out.push({ id: p.id, box: await seal(nextKey, p.bytes) }); p.bytes.fill(0); }
  const next = { ...(await lockMaterial(raw, newPassphrase, recoveryKey)), created: settings.created || new Date().toISOString(), changed: new Date().toISOString() };
  raw.fill(0);
  key = nextKey;
  touch();
  return { settings: next, recoveryKey, boxes: out };
}

export async function encryptJSON(obj) {
  if (!key) throw new Error('locked');
  touch();
  return { v: 1, ...(await seal(key, te.encode(JSON.stringify(obj)))) };
}
export async function decryptJSON(box) {
  if (!key) throw new Error('locked');
  return JSON.parse(td.decode(await open(key, box)));
}

// ---------- locking ----------
export function lock() {
  key = null;
  clearTimeout(lockTimer); lockTimer = null;
  onLock();
}
export function touch() { // any activity keeps the journal open for another 10 minutes
  if (!key) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(lock, AUTO_LOCK_MS);
}
export function initAutoLock(cb) {
  onLock = cb || (() => {});
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (key && hiddenAt && Date.now() - hiddenAt > BACKGROUND_LOCK_MS) lock();
  });
  window.addEventListener('pagehide', () => { if (key) hiddenAt = Date.now(); });
}

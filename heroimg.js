// heroimg.js
// Optional photo behind the Today header (off by default). The photo is scaled down on this device,
// kept locally for offline use, and stored in your private attachments folder for your other devices.
// No external image URLs are used.
import * as att from './attach.js';
import { getClient } from './sync.js';
import { get, save } from './core.js';

const LOCAL = 'heroImage';
let onReady = () => {};
export const setHeroReady = fn => { onReady = fn; };
const prefs = () => get('setting_prefs')?.data || {};
export const heroOn = () => !!prefs().heroImage?.on;
const localImg = () => { try { return localStorage.getItem(LOCAL); } catch { return null; } };

export function headerImageStyle() {
  if (!heroOn()) return '';
  const url = localImg();
  if (url) return `background-image:url('${url}')`;
  fetchRemote();
  return '';
}
async function fetchRemote() {
  const path = prefs().heroImage?.path;
  if (fetchRemote.busy || !path || !navigator.onLine || !att.canUpload()) return;
  fetchRemote.busy = true;
  try {
    const { data, error } = await getClient().storage.from('attachments').createSignedUrl(path, 600);
    if (error) throw error;
    const blob = await (await fetch(data.signedUrl)).blob();
    localStorage.setItem(LOCAL, await toDataURL(blob));
    onReady();
  } catch {}
  fetchRemote.busy = false;
}
const toDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

async function shrink(file) { // max 1400 px wide JPEG, so it stays small and fast
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
}

export async function pickHeroImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  const blob = await shrink(file);
  localStorage.setItem(LOCAL, await toDataURL(blob));
  const old = prefs().heroImage?.path;
  let path = '';
  if (att.canUpload() && navigator.onLine) {
    const up = await att.upload('header', new File([blob], 'header.jpg', { type: 'image/jpeg' }));
    path = up.path;
    if (old) att.removeFiles([old]);
  }
  await save('setting', 'setting_prefs', { ...prefs(), heroImage: { on: true, path: path || old || '' } });
}
export async function setHeroOn(on) {
  await save('setting', 'setting_prefs', { ...prefs(), heroImage: { ...(prefs().heroImage || {}), on } });
}
export async function removeHeroImage() {
  const old = prefs().heroImage?.path;
  try { localStorage.removeItem(LOCAL); } catch {}
  if (old) att.removeFiles([old]);
  await save('setting', 'setting_prefs', { ...prefs(), heroImage: { on: false, path: '' } });
}
export const heroPreview = () => localImg();

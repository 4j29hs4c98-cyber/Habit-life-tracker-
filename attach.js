// Links and documents on tasks and projects.
// Documents live in a private Supabase Storage folder per user: attachments/<user id>/<task or project id>/...
import { getClient, status } from './sync.js';

const BUCKET = 'attachments';
const MAX = 20 * 1024 * 1024; // 20 MB
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const safeName = n => (n || 'file').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);

export const canUpload = () => !!getClient() && !!status.user;

export async function upload(ownerId, file) {
  if (!canUpload()) throw new Error('Sign in to sync first to attach documents.');
  if (!navigator.onLine) throw new Error('Uploading documents needs an internet connection.');
  if (file.size > MAX) throw new Error('This file is larger than 20 MB.');
  const id = newId();
  const path = `${status.user.id}/${ownerId}/${id}-${safeName(file.name)}`;
  const { error } = await getClient().storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return { id, type: 'file', title: file.name, path, size: file.size, mime: file.type || '' };
}

export async function removeFiles(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length || !canUpload()) return;
  try { await getClient().storage.from(BUCKET).remove(list); } catch {}
}

// Opens a document in a new tab using a temporary private link (valid for 1 hour).
// The tab is opened right away so the browser doesn't block it.
export async function openFile(att) {
  if (!navigator.onLine) throw new Error('Opening documents needs an internet connection.');
  const win = window.open('', '_blank');
  try {
    const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(att.path, 3600);
    if (error) throw error;
    if (win) win.location.href = data.signedUrl; else location.href = data.signedUrl;
  } catch (e) {
    win?.close();
    throw e;
  }
}

export function makeLink(url, title) {
  let u = (url || '').trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  let x;
  try { x = new URL(u); } catch { return null; }
  if (!['http:', 'https:'].includes(x.protocol) || !x.hostname.includes('.')) return null;
  return { id: newId(), type: 'link', url: x.href, title: (title || '').trim() || x.hostname.replace(/^www\./, '') };
}

export function sizeText(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fileIcon(att) {
  const m = att.mime || '', n = (att.title || '').toLowerCase();
  if (m.startsWith('image/')) return '🖼️';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return '📄';
  if (/sheet|excel|csv/.test(m) || /\.(xlsx?|csv|numbers)$/.test(n)) return '📊';
  if (/presentation|powerpoint/.test(m) || /\.(pptx?|key)$/.test(n)) return '📽️';
  if (m.startsWith('audio/')) return '🎵';
  if (m.startsWith('video/')) return '🎬';
  return '📎';
}

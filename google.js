// Google Calendar events and unread email counts.
// The app never holds long-term Google access: a Supabase server function keeps it
// and returns only the data shown here. Results are cached for offline use.
import { GOOGLE_CLIENT_ID } from './config.js';
import { getClient, status } from './sync.js';

const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.labels';
export const G = { data: null, loading: false, error: null };
try { G.data = JSON.parse(localStorage.getItem('googleCache') || 'null'); } catch {}

export const configured = () => !!GOOGLE_CLIENT_ID;

export function preload() {
  if (!configured() || window.google?.accounts?.oauth2 || document.getElementById('gis')) return;
  const s = document.createElement('script');
  s.id = 'gis'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  document.head.appendChild(s);
}

async function call(body) {
  const { data, error } = await getClient().functions.invoke('google', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Must run directly from a tap, so the browser allows the Google window.
export function connect() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) { preload(); return reject(new Error('Google sign-in is still loading. Tap again in a moment.')); }
    const cl = google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPES, ux_mode: 'popup', select_account: true,
      callback: async r => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        try { const res = await call({ action: 'connect', code: r.code }); await refresh(); resolve(res.email); }
        catch (e) { reject(e); }
      },
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'The Google window was closed.' : (e.message || e.type))),
    });
    cl.requestCode();
  });
}

export async function disconnect(email) {
  await call({ action: 'disconnect', email });
  await refresh();
}

export async function refresh() {
  if (!configured() || !status.user || !navigator.onLine || G.loading) return;
  G.loading = true; G.error = null;
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    G.data = await call({ action: 'data', timeMin: start.toISOString(), timeMax: end.toISOString() });
    try { localStorage.setItem('googleCache', JSON.stringify(G.data)); } catch {}
  } catch (e) { G.error = e.message; }
  G.loading = false;
}

export function clearCache() {
  G.data = null;
  try { localStorage.removeItem('googleCache'); } catch {}
}

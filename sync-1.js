// Cloud sync with Supabase. Local data stays the source of truth;
// changes go up when online, and newer changes from other devices come down.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let client = null, hooks = null, timer = null, running = false, again = false, channel = null;
export const status = { user: null, state: 'off', last: null, error: null };
export const getClient = () => client;

export async function init(h) {
  hooks = h;
  if (!window.supabase?.createClient) { status.state = 'unavailable'; hooks.onStatus(); return; }
  // A password-reset link brings tokens (or an error) in the address; read it before Supabase clears it.
  const hash = new URLSearchParams(location.hash.slice(1));
  const isRecovery = hash.get('type') === 'recovery';
  const linkError = hash.get('error_description');
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  try { status.last = localStorage.getItem('lastSync'); } catch {}
  const { data: { session } } = await client.auth.getSession();
  status.user = session?.user || null;
  status.state = status.user ? 'idle' : 'signed-out';
  hooks.onStatus();
  if (linkError) { history.replaceState(null, '', location.pathname + '#more'); hooks.onLinkError(linkError); }
  if (isRecovery && status.user) hooks.onRecovery();
  client.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY' && !isRecovery) hooks.onRecovery();
    const before = status.user?.id;
    status.user = s?.user || null;
    if (!status.user) status.state = 'signed-out';
    else if (status.state === 'signed-out') status.state = 'idle';
    hooks.onStatus();
    if (status.user && status.user.id !== before) { unsubscribe(); subscribe(); setTimeout(syncNow, 0); }
    if (!status.user) unsubscribe();
  });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => { if (status.user) { status.state = 'offline'; hooks.onStatus(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  if (status.user) { subscribe(); syncNow(); }
}

// Live updates: the database tells this device when another device changed something.
function subscribe() {
  if (channel || !status.user || !client.channel) return;
  channel = client.channel(`records-${status.user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${status.user.id}` }, () => schedule(500))
    .subscribe();
}
function unsubscribe() {
  if (channel) { client.removeChannel(channel); channel = null; }
}

// Called after every change in the app: sync almost right away.
// The short wait groups quick taps (e.g. checking off 3 habits) into one upload.
export function schedule(delay = 300) {
  if (!status.user) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

const pullKey = () => `lastPull_${status.user.id}`;

export async function syncNow() {
  if (!client || !status.user) return;
  if (!navigator.onLine) { status.state = 'offline'; hooks.onStatus(); return; }
  if (running) { again = true; return; }
  running = true; status.state = 'syncing'; status.error = null; hooks.onStatus();
  try {
    // 1. Pull everything changed since last time (5 min overlap covers clock differences).
    let since = '1970-01-01T00:00:00.000Z';
    try { since = localStorage.getItem(pullKey()) || since; } catch {}
    const from = new Date(new Date(since).getTime() - 5 * 60000).toISOString();
    const incoming = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await client.from('records').select('id,kind,data,updated_at,deleted')
        .gt('updated_at', from).order('updated_at').range(off, off + 999);
      if (error) throw error;
      incoming.push(...data);
      if (data.length < 1000) break;
    }
    let maxSeen = since;
    for (const r of incoming) {
      r.updated_at = new Date(r.updated_at).toISOString();
      if (r.updated_at > maxSeen) maxSeen = r.updated_at;
    }
    if (incoming.length) await hooks.applyRemote(incoming);

    // 2. Push local changes that haven't been uploaded yet.
    const pending = hooks.pending();
    for (let i = 0; i < pending.length; i += 500) {
      const chunk = pending.slice(i, i + 500);
      const { error } = await client.from('records').upsert(
        chunk.map(r => ({ id: r.id, user_id: status.user.id, kind: r.kind, data: r.data, updated_at: r.updated_at, deleted: !!r.deleted })),
        { onConflict: 'user_id,id' });
      if (error) throw error;
      await hooks.markSynced(chunk);
    }
    status.last = new Date().toISOString();
    try { localStorage.setItem(pullKey(), maxSeen); localStorage.setItem('lastSync', status.last); } catch {}
    status.state = 'idle';
  } catch (e) {
    status.state = navigator.onLine ? 'error' : 'offline';
    status.error = e?.message || String(e);
  }
  running = false;
  hooks.onStatus();
  if (again) { again = false; syncNow(); }
}

export async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  return !!data.session; // true = signed in right away (email confirmation off)
}
export async function signOut() { await client.auth.signOut(); }

export async function resetPassword(email) {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}
export async function updatePassword(password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

// Turn Supabase messages into plain language.
export function friendly(e) {
  const m = (e?.message || String(e)).toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox and spam folder.';
  if (m.includes('rate limit')) return 'Too many emails right now. The free plan sends at most 2 per hour, so try again later.';
  if (m.includes('already registered')) return 'This email already has an account. Sign in, or use "Forgot password".';
  if (m.includes('should be different')) return 'The new password must be different from the old one.';
  if (m.includes('password should be at least') || m.includes('weak')) return 'Please choose a longer password (at least 8 characters).';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection. Try again when you are online.';
  return e?.message || 'Something went wrong. Try again.';
}

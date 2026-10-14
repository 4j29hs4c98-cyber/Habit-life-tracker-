// Push notifications on this device: permission, subscription and test.
import { getClient, status } from './sync.js';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function deviceName() {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return 'Android';
  if (isIOS()) return /iPhone/.test(ua) ? 'iPhone' : 'iPad';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Device';
}
async function call(body) {
  const { data, error } = await getClient().functions.invoke('notify', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function currentSubscription() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enable() {
  if (!supported()) {
    throw new Error(isIOS() && !isStandalone()
      ? 'On iPad and iPhone, first add the app to your Home Screen (Safari > Share > Add to Home Screen). Then open it from there and turn notifications on.'
      : 'This browser does not support notifications.');
  }
  if (!status.user) throw new Error('Sign in to sync first.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(perm === 'denied'
      ? 'Notifications are blocked. Allow them for this app in your device or browser settings, then try again.'
      : 'Notifications were not allowed.');
  }
  const { publicKey } = await call({ action: 'public-key' });
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const j = sub.toJSON();
  const { error } = await getClient().from('push_subscriptions').upsert(
    { endpoint: j.endpoint, user_id: status.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceName() },
    { onConflict: 'endpoint' });
  if (error) throw error;
}

export async function disable() {
  const sub = await currentSubscription();
  if (!sub) return;
  try { await getClient()?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch {}
  await sub.unsubscribe();
}

export const test = () => call({ action: 'test' });

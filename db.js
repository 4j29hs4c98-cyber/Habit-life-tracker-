// Local database: every item is one record in IndexedDB.
// Record shape (same as the future Supabase table, so sync can plug in later):
// { id, kind, data, updated_at, deleted, synced }

const DB_NAME = 'habit-life-os';
const STORE = 'records';
let db = null;
let memoryOnly = false;
const memory = new Map();

export function isMemoryOnly() { return memoryOnly; }

export function open() {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, 1); }
    catch { memoryOnly = true; return resolve(); }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('kind', 'kind');
      }
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => { memoryOnly = true; resolve(); };
  });
}

function store(mode) { return db.transaction(STORE, mode).objectStore(STORE); }

export function loadAll() {
  if (memoryOnly) return Promise.resolve([...memory.values()]);
  return new Promise((resolve, reject) => {
    const q = store('readonly').getAll();
    q.onsuccess = () => resolve(q.result || []);
    q.onerror = () => reject(q.error);
  });
}

export function putMany(records) {
  if (memoryOnly) { records.forEach(r => memory.set(r.id, r)); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const s = tx.objectStore(STORE);
    records.forEach(r => s.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function put(record) { return putMany([record]); }

export function clearAll() {
  if (memoryOnly) { memory.clear(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const q = store('readwrite').clear();
    q.onsuccess = () => resolve();
    q.onerror = () => reject(q.error);
  });
}

// Storage adapter: uses Claude's window.storage when this page is opened as a
// published Claude artifact. Otherwise (e.g. on GitHub Pages, or any normal
// browser/device) it talks to a free Firebase Realtime Database over plain
// REST calls, so the same data is visible from any browser or device —
// not just the one it was created in.
//
// ---- ONE-TIME SETUP ----
// 1. Go to https://console.firebase.google.com, create a free project.
// 2. In the project, open "Build" -> "Realtime Database" -> "Create Database".
//    Choose any region, and start in "test mode" (open read/write) — this app
//    already does its own name+password check, same light protection as before.
// 3. Copy the database URL shown at the top (looks like
//    https://YOUR-PROJECT-default-rtdb.firebaseio.com) and paste it below.
// -------------------------

const FIREBASE_DB_URL = 'https://tiffin-tracker-dce06-default-rtdb.firebaseio.com'; // <-- your Firebase database URL

function firebaseUrl(key) {
  return FIREBASE_DB_URL.replace(/\/$/, '') + '/data/' + encodeURIComponent(key) + '.json';
}

const firebaseStorage = {
  async get(key, shared) {
    const res = await fetch(firebaseUrl(key));
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const value = await res.json();
    if (value === null) throw new Error('Key not found: ' + key);
    return { key, value, shared: !!shared };
  },
  async set(key, value, shared) {
    const res = await fetch(firebaseUrl(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    return { key, value, shared: !!shared };
  },
  async delete(key, shared) {
    const res = await fetch(firebaseUrl(key), { method: 'DELETE' });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    return { key, deleted: true, shared: !!shared };
  },
  async list(prefix, shared) {
    const pfx = prefix || '';
    // Range query over child keys that start with pfx, ordered by key.
    const base = FIREBASE_DB_URL.replace(/\/$/, '') + '/data.json';
    const params = new URLSearchParams({
      orderBy: '"$key"',
      startAt: '"' + pfx + '"',
      endAt: '"' + pfx + '\uf8ff"'
    });
    const res = await fetch(base + '?' + params.toString());
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const obj = await res.json();
    const keys = obj ? Object.keys(obj).map(k => decodeURIComponent(k)) : [];
    return { keys, prefix, shared: !!shared };
  }
};

const storage = (typeof window.storage !== 'undefined' && window.storage) ? window.storage : firebaseStorage;

// Simple, dependency-free hash (no Web Crypto API — that can be unavailable
// inside sandboxed frames). This is light obfuscation, not real cryptography.
function simpleHash(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// Storage adapter: uses Claude's window.storage when this page is opened as a
// published Claude artifact, and automatically falls back to the browser's
// localStorage when run normally (e.g. via VS Code Live Server or a static host).
const storage = (typeof window.storage !== 'undefined' && window.storage) ? window.storage : {
  async get(key, shared) {
    const raw = window.localStorage.getItem((shared ? 'shared:' : 'priv:') + key);
    if (raw === null) throw new Error('Key not found: ' + key);
    return { key, value: raw, shared: !!shared };
  },
  async set(key, value, shared) {
    window.localStorage.setItem((shared ? 'shared:' : 'priv:') + key, value);
    return { key, value, shared: !!shared };
  },
  async delete(key, shared) {
    window.localStorage.removeItem((shared ? 'shared:' : 'priv:') + key);
    return { key, deleted: true, shared: !!shared };
  },
  async list(prefix, shared) {
    const pfx = (shared ? 'shared:' : 'priv:') + (prefix || '');
    const keys = Object.keys(window.localStorage)
      .filter(k => k.startsWith(pfx))
      .map(k => k.slice(shared ? 7 : 5));
    return { keys, prefix, shared: !!shared };
  }
};

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

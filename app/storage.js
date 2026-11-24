import { DATA_KEYS, merge, startCloudSync } from '../cloud-sync.js';

export function readLocal(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function openStorage(owner) {
  const prefix = `lumi-account:${owner}:`;
  const listeners = new Set();
  let sync;
  const ownership = 'lumi-legacy-account';
  const legacyOwners = Object.keys(localStorage)
    .map(key => /^lumi-sync-base-(\d+)$/.exec(key)?.[1]).filter(Boolean);
  const canImport = () => {
    const linked = readLocal(ownership);
    if (owner === 'guest' || (linked && linked !== owner)) return false;
    if (legacyOwners.length && !legacyOwners.includes(owner)) return false;
    return !localStorage.getItem(prefix + 'legacy-imported') &&
      DATA_KEYS.some(key => localStorage.getItem(key) !== null);
  };
  const notify = () => listeners.forEach(listener => listener());
  const onStorage = event => {
    if (!event.key || event.key.startsWith(prefix)) notify();
  };
  const store = {
    read: key => readLocal(prefix + key),
    write(key, value) {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    update(key, change) {
      const value = change(store.read(key));
      store.write(key, value);
      sync?.schedule();
      notify();
    },
    canImport,
    importLegacy() {
      if (!canImport()) return;
      // Leave the original records intact. Keep edits made in the current account.
      localStorage.setItem(ownership, JSON.stringify(owner));
      for (const key of DATA_KEYS) {
        const legacy = readLocal(key);
        if (legacy !== null) store.write(key, merge(null, store.read(key), legacy));
      }
      localStorage.setItem(prefix + 'legacy-imported', '1');
      sync?.schedule();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) window.removeEventListener('storage', onStorage);
      };
    },
    connect(initData, onStatus) {
      sync = startCloudSync(initData, owner, onStatus, store, notify);
      return () => { sync.stop(); sync = undefined; };
    },
  };
  return store;
}

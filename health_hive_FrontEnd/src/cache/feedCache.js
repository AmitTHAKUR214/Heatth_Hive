const STORAGE_KEY = "hh_feed_cache";
const MAX_AGE_MS  = 5 * 60 * 1000; // 5 minutes

const read = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const write = (cache) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch {}
};

export const feedCache = {
  get(key) {
    const cache = read();
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > MAX_AGE_MS) {
      this.delete(key);
      return null;
    }
    return entry;
  },
  set(key, value) {
    const cache = read();
    cache[key] = { ...value, ts: Date.now() };
    write(cache);
  },
  delete(key) {
    const cache = read();
    delete cache[key];
    write(cache);
  },
  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  },
};
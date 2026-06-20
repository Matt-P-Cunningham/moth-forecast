// LocalStorage cache with per-type TTLs
const P = 'ml_c_';
const TTL = { species: 86400000, weather: 3600000, ecoregion: 604800000 };

export function getCache(type, key) {
  try {
    const raw = localStorage.getItem(P + type + '_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > (TTL[type] ?? 3600000)) return null;
    return data;
  } catch { return null; }
}

export function setCache(type, key, data) {
  try {
    localStorage.setItem(P + type + '_' + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { pruneCache(); }
}

export function getCacheAge(type, key) {
  try {
    const raw = localStorage.getItem(P + type + '_' + key);
    return raw ? Date.now() - JSON.parse(raw).ts : null;
  } catch { return null; }
}

function pruneCache() {
  Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => {
    try { if (Date.now() - JSON.parse(localStorage.getItem(k)).ts > 86400000) localStorage.removeItem(k); }
    catch { localStorage.removeItem(k); }
  });
}

const KEY_LAST = 'wft_last';
const KEY_RADIUS = 'wft_radius';

export function loadSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_LAST));
    if (saved && saved.lat && saved.lng) return saved;
  } catch(e) {}
  return null;
}

export function saveLocation(lat, lng, name, radius) {
  try { localStorage.setItem(KEY_LAST, JSON.stringify({ lat, lng, name, radius })); } catch(e) {}
}

export function loadSavedRadius(defaultVal = 80) {
  try {
    const r = parseInt(localStorage.getItem(KEY_RADIUS), 10);
    if (!isNaN(r) && r >= 10 && r <= 200) return r;
  } catch(e) {}
  return defaultVal;
}

export function saveRadius(r) {
  try { localStorage.setItem(KEY_RADIUS, String(r)); } catch(e) {}
}

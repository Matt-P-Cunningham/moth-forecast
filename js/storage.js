const KEY_LAST = 'wft_last';

export function loadSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_LAST));
    if (saved && saved.lat && saved.lng) return saved;
  } catch(e) {}
  return null;
}

export function saveLocation(lat, lng, name) {
  try { localStorage.setItem(KEY_LAST, JSON.stringify({ lat, lng, name })); } catch(e) {}
}

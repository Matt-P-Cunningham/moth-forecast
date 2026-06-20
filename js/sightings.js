const KEY = 'ml_sightings';

export function getSightings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {}
}

export function addSighting({ id, inatId, name, sci, photoUrl, score, lat, lng, ecoregion }) {
  const entry = {
    uid: `${id}_${Date.now()}`,
    id, inatId, name, sci, photoUrl: photoUrl || null, score,
    lat: lat ? +lat.toFixed(5) : null,
    lng: lng ? +lng.toFixed(5) : null,
    ecoregion: ecoregion || '',
    ts: Date.now(),
  };
  const list = getSightings();
  list.unshift(entry);
  save(list);
  return entry;
}

export function deleteSighting(uid) {
  save(getSightings().filter(s => s.uid !== uid));
}

export function hasSighting(id) {
  const today = new Date().toDateString();
  return getSightings().some(s => s.id === id && new Date(s.ts).toDateString() === today);
}

export function getTonightCount() {
  const today = new Date().toDateString();
  return getSightings().filter(s => new Date(s.ts).toDateString() === today).length;
}

export function getSightingsGroupedByDate() {
  const all = getSightings();
  const groups = {};
  for (const s of all) {
    const d = new Date(s.ts);
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

const KEY = 'ml_sightings';

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getSightings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

// stores { id, speciesId, commonName, sciName, timestamp, date, time, location, lat, lng, ecoregion, score }
export function addSighting({ speciesId, commonName, sciName, location, lat, lng, ecoregion, score }) {
  const now = new Date();
  const entry = {
    id: `${sciName.replace(/\s+/g, '_')}_${now.getTime()}`,
    speciesId,
    commonName,
    sciName,
    timestamp: now.getTime(),
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    location: location || '',
    lat: lat != null ? +lat : null,
    lng: lng != null ? +lng : null,
    ecoregion: ecoregion || '',
    score: score || 0,
  };
  const list = getSightings();
  list.unshift(entry);
  save(list);
  return entry;
}

// Returns all sightings grouped by YYYY-MM-DD key
export function getSightingsByDate() {
  const all = getSightings();
  const groups = {};
  for (const s of all) {
    const key = s.date || new Date(s.timestamp || 0).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

// Delete one specific entry by its entry id
export function removeSighting(entryId) {
  save(getSightings().filter(s => s.id !== entryId));
}

// Remove today's sighting for a species (used by card toggle)
export function removeSightingBySpec(sciName, date) {
  const d = date || todayDate();
  save(getSightings().filter(s => !(s.sciName === sciName && s.date === d)));
}

// True if this species is already logged on the given date (defaults to today)
export function hasSighting(sciName, date) {
  const d = date || todayDate();
  return getSightings().some(s => s.sciName === sciName && s.date === d);
}

export function getTonightCount() {
  return getSightings().filter(s => s.date === todayDate()).length;
}

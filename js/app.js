import { state } from './state.js';
import { ICONS, moonPhaseSVG } from './icons.js';
import { todayStr } from './utils.js';
import { getMoonPhase } from './moon.js';
import { fetchForecast, findNowIndex, findPeakIndex } from './forecast.js';
import { fetchAllSpecies } from './species/index.js';
import { fetchHabitat } from './habitat/index.js';
import { geocodeText, reverseGeocode, getBrowserLocation } from './geo.js';
import { initMap, placeMarker, setMapZoom, onRadiusInput, onRadiusChange } from './map.js';
import { loadSavedLocation, loadSavedRadius, saveLocation } from './storage.js';
import { selectHour } from './ui/timeline.js';
import { renderMoths, setView } from './ui/moths.js';
import { openModal, closeModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';

// Expose globals for inline HTML event handlers
window.__mothApp = {
  selectHour,
  openModal,
  closeModal,
  setView,
  showToast,
  renderMoths,
  handleImgError: img => {
    const { ICONS: I } = window.__mothApp;
    img.parentElement.innerHTML = `<span class="icon icon-lg icon-muted">${I.bug}</span>`;
  },
  shareMoth,
  searchByText,
  geoLocate,
  ICONS,
  get _state() { return state; },
  onRadiusInput: v => onRadiusInput(v),
  onRadiusChange: v => onRadiusChange(v, reloadMoths),
};

// ─── Status ──────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.style.display = msg ? 'block' : 'none';
  el.className = 'status-bar' + (isError ? ' error' : '');
  el.textContent = msg;
}

function showSkeletons() {
  document.getElementById('controls-section').style.display = 'block';
  document.getElementById('results').innerHTML =
    '<div class="moth-grid">' + Array(12).fill('<div class="skeleton"></div>').join('') + '</div>';
}

// ─── Main fetch ─────────────────────────────────────────────────
async function fetchAll(lat, lng, locationName) {
  state.currentLat = lat;
  state.currentLng = lng;
  state.currentName = locationName;
  saveLocation(lat, lng, locationName, state.radiusKm);

  setStatus(`Loading forecast and moths for ${locationName}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';
  document.getElementById('timeline-section').style.display = 'none';
  placeMarker(lat, lng, true);

  const [hours, mothData, habitatData] = await Promise.all([
    fetchForecast(lat, lng),
    fetchAllSpecies(lat, lng, state.radiusKm),
    fetchHabitat(lat, lng, state.radiusKm),
  ]);

  state.habitat = habitatData;

  if (hours && hours.length) {
    state.forecastHours = hours;
    state.nowIndex = findNowIndex(hours);
    state.peakIndex = findPeakIndex(hours, state.nowIndex);
    document.getElementById('timeline-section').style.display = 'block';
    selectHour(state.peakIndex);
  } else {
    state.forecastHours = [];
    setStatus('Could not load forecast data. Check your connection and try again.', true);
  }

  if (!mothData) {
    setStatus('Could not load species data. Check your connection and try again.', true);
    document.getElementById('results').innerHTML = '';
    return;
  }

  state.allMoths = mothData;
  if (!state.allMoths.length) {
    setStatus('');
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No moth records found near this location for this time of year.</div>`;
    return;
  }

  const total = state.allMoths.reduce((s, m) => s + m.count, 0);
  const inatOnly = state.allMoths.filter(m => m.source === 'inat').length;
  const gbifOnly = state.allMoths.filter(m => m.source === 'gbif').length;
  const both = state.allMoths.filter(m => m.source === 'both').length;
  const sourceNote = ` · iNat: ${inatOnly + both} · GBIF: ${gbifOnly + both}`;
  setStatus(`${state.allMoths.length} species · ${total.toLocaleString()} records within ${state.radiusKm}km of ${locationName}${sourceNote}`);

  document.getElementById('controls-section').style.display = 'block';
  renderMoths();
}

async function reloadMoths() {
  setStatus(`Reloading species for a ${state.radiusKm}km radius around ${state.currentName}…`);
  showSkeletons();
  const [mothData, habitatData] = await Promise.all([
    fetchAllSpecies(state.currentLat, state.currentLng, state.radiusKm),
    fetchHabitat(state.currentLat, state.currentLng, state.radiusKm),
  ]);
  state.habitat = habitatData;
  if (!mothData) {
    setStatus('Could not reload species. Check your connection and try again.', true);
    return;
  }
  state.allMoths = mothData;
  const total = state.allMoths.reduce((s, m) => s + m.count, 0);
  setStatus(`${state.allMoths.length} species · ${total.toLocaleString()} records within ${state.radiusKm}km of ${state.currentName}`);
  renderMoths();
}

// ─── Search / geolocation ────────────────────────────────────────
async function searchByText() {
  const q = document.getElementById('loc-input').value.trim();
  if (!q) return;
  setStatus('Looking up location…');
  try {
    const result = await geocodeText(q);
    if (!result) { setStatus('Location not found. Try a city, region, country, or postal code.', true); return; }
    document.getElementById('loc-input').value = result.name;
    fetchAll(result.lat, result.lng, result.name);
  } catch(e) { setStatus('Could not look up location. Try again.', true); }
}

async function geoLocate() {
  if (!navigator.geolocation) {
    setStatus('Geolocation not supported. Search by city name or use the map instead.', true);
    return;
  }
  setStatus('Getting your location…');
  try {
    const { lat, lng } = await getBrowserLocation();
    const name = await reverseGeocode(lat, lng);
    document.getElementById('loc-input').value = name;
    fetchAll(lat, lng, name);
  } catch(e) {
    setStatus('Could not get location. Search by city name or use the map instead.', true);
  }
}

async function onMapPick(lat, lng) {
  lat = (+lat).toFixed(5);
  lng = (+lng).toFixed(5);
  setStatus('Looking up the pinned location…');
  const name = await reverseGeocode(lat, lng);
  document.getElementById('loc-input').value = name;
  fetchAll(lat, lng, name);
}

// ─── Share ───────────────────────────────────────────────────────
function shareMoth(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;
  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const url = inatId
    ? `https://www.inaturalist.org/taxa/${inatId}`
    : `https://www.gbif.org/species/${m.gbifKey}`;
  const h = state.forecastHours[state.selectedIndex];
  const when = h ? `${h.mo}/${h.d}` : 'soon';
  const text = `Check out the ${m.name} — a moth that might be flying near ${state.currentName || 'me'} around ${when}!\n${url}`;
  if (navigator.share) {
    navigator.share({ title: m.name, text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Link copied to clipboard'));
  } else {
    showToast('Copy unavailable in this browser');
  }
}

// ─── Init ────────────────────────────────────────────────────────
document.getElementById('header-date').textContent = todayStr();
document.getElementById('loc-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchByText(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.getElementById('icon-search').innerHTML = ICONS.search;
document.getElementById('icon-mylocation').innerHTML = ICONS.pin;
document.getElementById('icon-maphint').innerHTML = ICONS.pin;
document.getElementById('icon-grid').innerHTML = ICONS.grid;
document.getElementById('icon-list').innerHTML = ICONS.list;
document.getElementById('icon-chevleft').innerHTML = ICONS.chevronLeft;
document.getElementById('icon-chevright').innerHTML = ICONS.chevronRight;
document.getElementById('icon-star-badge').innerHTML = ICONS.star;
document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(getMoonPhase().fraction);

state.radiusKm = loadSavedRadius(80);
document.getElementById('radius-input').value = state.radiusKm;
document.getElementById('radius-value').textContent = state.radiusKm + ' km';

const saved = loadSavedLocation();
if (saved) {
  document.getElementById('loc-input').value = saved.name;
  initMap(saved.lat, saved.lng, onMapPick);
  fetchAll(saved.lat, saved.lng, saved.name);
} else {
  initMap(20, 0, onMapPick);
  setMapZoom(2);
  geoLocate();
}

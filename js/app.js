import { state } from './state.js';
import { ICONS, moonPhaseSVG } from './icons.js';
import { todayStr } from './utils.js';
import { getMoonPhase } from './moon.js';
import { fetchForecast, findNowIndex, findPeakIndex } from './forecast.js';
import { fetchAllSpecies } from './species/index.js';
import { fetchHabitat } from './habitat/index.js';
import { fetchEcoregionAtPoint, fetchNeighboringEcoregions } from './ecoregion.js';
import { geocodeText, reverseGeocode, getBrowserLocation } from './geo.js';
import { initMap, placeMarker, setMapZoom, setEcoregionLayers, clearEcoregionLayers } from './map.js';
import { loadSavedLocation, saveLocation } from './storage.js';
import { selectHour } from './ui/timeline.js';
import { renderMoths, setView } from './ui/moths.js';
import { openModal, closeModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';

const FALLBACK_RADIUS_KM = 100;

window.__mothApp = {
  selectHour,
  openModal,
  closeModal,
  setView,
  showToast,
  renderMoths,
  handleImgError: img => {
    img.parentElement.innerHTML = `<span class="icon icon-lg icon-muted">${ICONS.bug}</span>`;
  },
  shareMoth,
  searchByText,
  geoLocate,
  ICONS,
  get _state() { return state; },
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

// ─── Ecoregion UI ────────────────────────────────────────────────
function updateEcoregionDisplay(eco) {
  const el = document.getElementById('ecoregion-info');
  if (!eco) {
    el.style.display = 'none';
    return;
  }
  document.getElementById('ecoregion-name').textContent = eco.name;
  document.getElementById('ecoregion-l2').textContent = eco.l2name;
  document.getElementById('ecoregion-l1').textContent = eco.l1name;
  el.style.display = 'flex';
}

// ─── Ecoregion neighbor click ─────────────────────────────────────
async function onNeighborClick(code, feature) {
  // Find the full eco object from neighbor list; rebuild from feature if needed
  const eco = {
    code,
    name: feature.properties.US_L3NAME,
    l2name: feature.properties.NA_L2NAME,
    l1name: feature.properties.NA_L1NAME,
    bbox: getBboxFromFeature(feature),
    feature,
  };
  state.ecoregion = eco;
  updateEcoregionDisplay(eco);
  setStatus(`Switching to ${eco.name}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';

  // Refresh neighbors and species for the newly selected ecoregion
  const [mothData, neighbors] = await Promise.all([
    fetchAllSpecies(state.currentLat, state.currentLng, { bbox: eco.bbox }),
    fetchNeighboringEcoregions(eco.bbox, eco.code),
  ]);

  setEcoregionLayers(eco.feature, neighbors.map(n => n.feature), onNeighborClick);

  if (!mothData || !mothData.length) {
    setStatus(`No moth records found in the ${eco.name} ecoregion for this time of year.`);
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No records found.</div>`;
    return;
  }
  state.allMoths = mothData;
  const total = mothData.reduce((s, m) => s + m.count, 0);
  setStatus(`${mothData.length} species · ${total.toLocaleString()} records · ${eco.name}`);
  document.getElementById('controls-section').style.display = 'block';
  renderMoths();
}

function getBboxFromFeature(feature) {
  const pts = [];
  function walk(c) {
    if (typeof c[0] === 'number') pts.push(c);
    else c.forEach(walk);
  }
  walk(feature.geometry.coordinates);
  return {
    swlat: Math.min(...pts.map(p => p[1])),
    swlng: Math.min(...pts.map(p => p[0])),
    nelat: Math.max(...pts.map(p => p[1])),
    nelng: Math.max(...pts.map(p => p[0])),
  };
}

// ─── Main fetch ─────────────────────────────────────────────────
async function fetchAll(lat, lng, locationName) {
  state.currentLat = lat;
  state.currentLng = lng;
  state.currentName = locationName;
  saveLocation(lat, lng, locationName, null);

  setStatus(`Locating ecoregion and loading forecast for ${locationName}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';
  document.getElementById('timeline-section').style.display = 'none';
  updateEcoregionDisplay(null);
  clearEcoregionLayers();
  placeMarker(lat, lng, true);

  // Phase 1: ecoregion + forecast in parallel (ecoregion drives species bbox)
  const [hours, ecoData] = await Promise.all([
    fetchForecast(lat, lng),
    fetchEcoregionAtPoint(lat, lng),
  ]);

  state.ecoregion = ecoData;
  updateEcoregionDisplay(ecoData);

  const queryOpts = ecoData
    ? { bbox: ecoData.bbox }
    : { radiusKm: FALLBACK_RADIUS_KM };

  if (!ecoData) {
    document.getElementById('ecoregion-note').textContent =
      `Ecoregion data covers the continental US. Using ${FALLBACK_RADIUS_KM}km radius.`;
    document.getElementById('ecoregion-note').style.display = 'block';
  } else {
    document.getElementById('ecoregion-note').style.display = 'none';
  }

  // Phase 2: species + habitat + neighbors in parallel
  const [mothData, habitatData, neighbors] = await Promise.all([
    fetchAllSpecies(lat, lng, queryOpts),
    fetchHabitat(lat, lng, ecoData ? 50 : FALLBACK_RADIUS_KM),
    ecoData ? fetchNeighboringEcoregions(ecoData.bbox, ecoData.code) : Promise.resolve([]),
  ]);

  if (ecoData) {
    setEcoregionLayers(ecoData.feature, neighbors.map(n => n.feature), onNeighborClick);
  }

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
    const areaLabel = ecoData ? `the ${ecoData.name} ecoregion` : `within ${FALLBACK_RADIUS_KM}km of this location`;
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No moth records found in ${areaLabel} for this time of year.</div>`;
    return;
  }

  const total = state.allMoths.reduce((s, m) => s + m.count, 0);
  const inatCount = state.allMoths.filter(m => m.source !== 'gbif').length;
  const gbifCount = state.allMoths.filter(m => m.source !== 'inat').length;
  const areaLabel = ecoData ? ecoData.name : `${FALLBACK_RADIUS_KM}km radius`;
  setStatus(`${state.allMoths.length} species · ${total.toLocaleString()} records · ${areaLabel} · iNat: ${inatCount} · GBIF: ${gbifCount}`);

  document.getElementById('controls-section').style.display = 'block';
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
  setStatus('Looking up location…');
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
  const eco = state.ecoregion;
  const where = eco ? eco.name : state.currentName || 'this location';
  const text = `Check out the ${m.name} — a moth that may be flying in the ${where}!\n${url}`;
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

document.querySelectorAll('#sort-sel, #freq-sel, #habitat-sel').forEach(el => {
  el.addEventListener('change', () => {
    if (window.__mothApp && window.__mothApp.renderMoths) window.__mothApp.renderMoths();
  });
});

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

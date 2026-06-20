import { state } from './state.js';
import { ICONS, moonPhaseSVG } from './icons.js';
import { getMoonPhase } from './moon.js';
import { fetchForecast, findNowIndex, findPeakIndex } from './forecast.js';
import { fetchAllSpecies } from './species/index.js';
import { fetchHabitat } from './habitat/index.js';
import { fetchEcoregionAtPoint, fetchNeighboringEcoregions } from './ecoregion.js';
import { geocodeText, reverseGeocode, getBrowserLocation } from './geo.js';
import { loadSavedLocation, saveLocation } from './storage.js';
import { selectHour } from './ui/timeline.js';
import { renderMoths } from './ui/moths.js';
import { openModal, closeModal } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { initMap, placeMarker, setEcoregionLayers, invalidateMapSize } from './map.js';

const FALLBACK_RADIUS_KM = 100;
let _sheetOpen = false;
let _drawerOpen = false;
let _sheetMapInited = false;
let _neighbors = [];

window.__mothApp = {
  selectHour,
  openModal,
  closeModal,
  showToast,
  renderMoths,
  handleImgError: img => {
    const container = img.closest('.species-photo, .modal-img');
    if (container) container.innerHTML = `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;
  },
  shareMoth,
  searchByText,
  geoLocate,
  toggleLocationSheet,
  toggleDrawer,
  switchTab,
  toggleTheme,
  openLightbox,
  _switchNeighbor: idx => {
    const n = _neighbors[idx];
    if (n) onNeighborClick(n.code, n.feature);
  },
  ICONS,
  get _state() { return state; },
};

// ─── Keyboard / safe-area ─────────────────────────────────────────
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const kbH = Math.max(0, window.innerHeight - window.visualViewport.height);
    document.documentElement.style.setProperty('--keyboard-h', `${kbH}px`);
    document.documentElement.classList.toggle('keyboard-open', kbH > 50);
  });
}

// ─── Theme ───────────────────────────────────────────────────────
const SUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;

function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const toggle = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  const icon = document.getElementById('theme-icon');
  if (toggle) toggle.checked = isDark;
  if (label) label.textContent = isDark ? 'Dark mode' : 'Light mode';
  if (icon) icon.outerHTML = (isDark ? MOON_ICON : SUN_ICON).replace('<svg ', '<svg id="theme-icon" ');
}

function initTheme() {
  const saved = localStorage.getItem('moth_theme');
  applyTheme(saved !== 'light');
}

function toggleTheme() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  const newDark = !isDark;
  applyTheme(newDark);
  localStorage.setItem('moth_theme', newDark ? 'dark' : 'light');
}

// ─── Status ──────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.style.display = msg ? 'block' : 'none';
  el.className = 'status-bar' + (isError ? ' error' : '');
  el.textContent = msg;
}

function setLocationLabel(name) {
  document.getElementById('location-label').textContent = name || 'Set location';
}

function showSkeletons() {
  document.getElementById('controls-section').style.display = 'block';
  document.getElementById('results').innerHTML =
    '<div class="species-list">' +
    Array(8).fill('<div class="skeleton-card"></div>').join('') +
    '</div>';
}

// ─── Tab switching ────────────────────────────────────────────────
function switchTab(tab) {
  const tabs = ['forecast', 'identify', 'mylist', 'settings'];
  for (const t of tabs) {
    const pane = document.getElementById(`tab-${t}`);
    if (pane) pane.classList.toggle('active', t === tab);
    const item = document.getElementById(`di-${t}`);
    if (item) item.classList.toggle('active', t === tab);
  }
  // Close drawer after switching
  if (_drawerOpen) toggleDrawer();
}

// ─── Drawer ───────────────────────────────────────────────────────
function toggleDrawer() {
  _drawerOpen = !_drawerOpen;
  document.getElementById('drawer').classList.toggle('open', _drawerOpen);
  document.getElementById('drawer-backdrop').classList.toggle('open', _drawerOpen);
}

// ─── Lightbox ────────────────────────────────────────────────────
function openLightbox(src, alt) {
  if (!src) return;
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}" alt="${alt || ''}" class="lightbox-img">
    <button class="lightbox-close" aria-label="Close photo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  // Tap anywhere — including the image — dismisses the lightbox
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// ─── Location sheet ───────────────────────────────────────────────
function toggleLocationSheet(force) {
  _sheetOpen = force !== undefined ? !!force : !_sheetOpen;
  document.getElementById('location-sheet').style.display = _sheetOpen ? 'block' : 'none';
  document.getElementById('sheet-backdrop').style.display = _sheetOpen ? 'block' : 'none';
  if (_sheetOpen) {
    // Focus and move cursor to start so the full location name is visible from the left
    setTimeout(() => {
      const inp = document.getElementById('loc-input');
      inp.focus();
      inp.setSelectionRange(0, 0);
    }, 60);
    // Init map on first open
    if (!_sheetMapInited) {
      _sheetMapInited = true;
      const lat = state.currentLat || 41.3;
      const lng = state.currentLng || -105.6;
      initMap(lat, lng, onMapPick);
      if (state.ecoregion) setEcoregionLayers(state.ecoregion.feature, [], () => {});
    }
    setTimeout(() => invalidateMapSize(), 200);
  }
}

// ─── Map pick callback ────────────────────────────────────────────
async function onMapPick(lat, lng) {
  placeMarker(lat, lng, false);
  setStatus('Detecting location…');
  try {
    const name = await reverseGeocode(lat, lng);
    document.getElementById('loc-input').value = name;
    fetchAll(lat, lng, name);
  } catch {
    setStatus('Could not detect location name. Try searching.', true);
  }
}

// ─── Ecoregion UI ────────────────────────────────────────────────
function updateEcoSelect(eco, neighbors) {
  _neighbors = neighbors || [];
  const sel = document.getElementById('eco-sel');
  if (!sel) return;

  if (!eco) {
    sel.innerHTML = '<option value="current">Detecting ecoregion…</option>';
    sel.disabled = true;
    sel.classList.remove('neighbor-active');
    return;
  }

  let html = `<option value="current">${esc(eco.name)} (current)</option>`;
  const limited = _neighbors.slice(0, 8);
  for (let i = 0; i < limited.length; i++) {
    html += `<option value="n${i}">${esc(limited[i].name)}</option>`;
  }
  sel.innerHTML = html;
  sel.disabled = false;
  sel.value = 'current';
  sel.classList.remove('neighbor-active');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Eco select change ────────────────────────────────────────────
document.getElementById('eco-sel').addEventListener('change', function() {
  if (this.value === 'current') {
    this.classList.remove('neighbor-active');
    // Re-run current ecoregion
    if (state.ecoregion) {
      onNeighborClick(state.ecoregion.code, state.ecoregion.feature);
    }
  } else {
    const idx = parseInt(this.value.replace('n', ''), 10);
    const n = _neighbors[idx];
    if (n) {
      this.classList.add('neighbor-active');
      onNeighborClick(n.code, n.feature);
    }
  }
});

// ─── Neighbor ecoregion click ─────────────────────────────────────
async function onNeighborClick(code, feature) {
  const eco = {
    code,
    name: feature.properties.US_L4NAME,
    l3name: feature.properties.US_L3NAME,
    l2name: feature.properties.NA_L2NAME,
    l1name: feature.properties.NA_L1NAME,
    bbox: getBboxFromFeature(feature),
    feature,
  };
  state.ecoregion = eco;
  setLocationLabel(eco.name);
  setStatus(`Switching to ${eco.name}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';

  const [mothData, neighbors] = await Promise.all([
    fetchAllSpecies(state.currentLat, state.currentLng, { bbox: eco.bbox }),
    fetchNeighboringEcoregions(eco.bbox, eco.code),
  ]);

  updateEcoSelect(eco, neighbors);
  document.getElementById('conditions-section').style.display = 'block';

  if (!mothData || !mothData.length) {
    setStatus(`No moth records in ${eco.name} for this time of year.`);
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No records found.</div>`;
    return;
  }
  state.allMoths = mothData;
  setStatus('');
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
  saveLocation(lat, lng, locationName);
  setLocationLabel(locationName);
  toggleLocationSheet(false);

  setStatus(`Loading forecast for ${locationName}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';
  document.getElementById('timeline-section').style.display = 'none';
  updateEcoSelect(null, []);

  const [hours, ecoData] = await Promise.all([
    fetchForecast(lat, lng),
    fetchEcoregionAtPoint(lat, lng),
  ]);

  state.ecoregion = ecoData;

  // Update map ecoregion layer if map is inited
  if (_sheetMapInited && ecoData) {
    placeMarker(lat, lng, false);
    setEcoregionLayers(ecoData.feature, [], () => {});
  }

  const queryOpts = ecoData ? { bbox: ecoData.bbox } : { radiusKm: FALLBACK_RADIUS_KM };

  const [mothData, habitatData, neighbors] = await Promise.all([
    fetchAllSpecies(lat, lng, queryOpts),
    fetchHabitat(lat, lng, ecoData ? 50 : FALLBACK_RADIUS_KM),
    ecoData ? fetchNeighboringEcoregions(ecoData.bbox, ecoData.code) : Promise.resolve([]),
  ]);

  state.habitat = habitatData;
  updateEcoSelect(ecoData, neighbors);

  if (hours && hours.length) {
    state.forecastHours = hours;
    state.nowIndex = findNowIndex(hours);
    state.peakIndex = findPeakIndex(hours, state.nowIndex);
    document.getElementById('timeline-section').style.display = 'block';
    selectHour(state.peakIndex);
  } else {
    state.forecastHours = [];
    setStatus('Could not load forecast. Check your connection.', true);
  }

  if (!mothData) {
    setStatus('Could not load species data. Check your connection.', true);
    document.getElementById('results').innerHTML = '';
    return;
  }

  state.allMoths = mothData;

  if (!state.allMoths.length) {
    setStatus('');
    const area = ecoData ? `the ${ecoData.name} ecoregion` : `within ${FALLBACK_RADIUS_KM}km`;
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No moth records found in ${area} for this time of year.</div>`;
    return;
  }

  setStatus('');
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
    if (!result) { setStatus('Location not found. Try a city or region.', true); return; }
    document.getElementById('loc-input').value = result.name;
    fetchAll(result.lat, result.lng, result.name);
  } catch { setStatus('Could not look up location. Try again.', true); }
}

async function geoLocate() {
  if (!navigator.geolocation) {
    setStatus('GPS not available — search by city name', true);
    toggleLocationSheet(true);
    return;
  }
  setStatus('Getting GPS location…');
  try {
    const { lat, lng } = await getBrowserLocation();
    const name = await reverseGeocode(lat, lng);
    document.getElementById('loc-input').value = name;
    fetchAll(lat, lng, name);
  } catch {
    setStatus('GPS unavailable — enter a city or region to continue', true);
    toggleLocationSheet(true);
  }
}

// ─── Share ───────────────────────────────────────────────────────
function shareMoth(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;
  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const url = inatId
    ? `https://www.inaturalist.org/taxa/${inatId}`
    : `https://www.gbif.org/species/${m.gbifKey}`;
  const where = state.ecoregion ? state.ecoregion.name : state.currentName || 'this location';
  const text = `Check out the ${m.name} — a moth flying in the ${where}!\n${url}`;
  if (navigator.share) {
    navigator.share({ title: m.name, text, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Link copied to clipboard'));
  } else {
    showToast('Copy unavailable in this browser');
  }
}

// ─── Init ─────────────────────────────────────────────────────────
document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(getMoonPhase().fraction);
document.getElementById('icon-chevleft').innerHTML = ICONS.chevronLeft;
document.getElementById('icon-chevright').innerHTML = ICONS.chevronRight;
document.getElementById('icon-star-badge').innerHTML = ICONS.star;

// Drawer icons
document.getElementById('di-icon-forecast').innerHTML = ICONS.moon;
document.getElementById('di-icon-identify').innerHTML = ICONS.camera;
document.getElementById('di-icon-mylist').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
document.getElementById('di-icon-settings').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

document.getElementById('loc-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchByText();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); toggleLocationSheet(false); if (_drawerOpen) toggleDrawer(); }
});
document.querySelectorAll('#sort-sel, #freq-sel, #habitat-sel').forEach(el =>
  el.addEventListener('change', () => window.__mothApp.renderMoths())
);

initTheme();

const saved = loadSavedLocation();
if (saved) {
  setLocationLabel(saved.name);
  document.getElementById('loc-input').value = saved.name;
  fetchAll(saved.lat, saved.lng, saved.name);
} else {
  geoLocate();
}

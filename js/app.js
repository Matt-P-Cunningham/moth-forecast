import { state } from './state.js';
import { ICONS, moonPhaseSVG } from './icons.js';
import { getMoonPhase } from './moon.js';
import { fetchForecast, fetchMoonData, findNowIndex, findPeakIndex } from './forecast.js';
import { fetchSpeciesPage, resetSpeciesPagination, clearGBIFCache } from './species/index.js';
import { fetchHabitat } from './habitat/index.js';
import { fetchEcoregionAtPoint, fetchNeighboringEcoregions } from './ecoregion.js';
import { geocodeText, reverseGeocode, getBrowserLocation } from './geo.js';
import { loadSavedLocation, saveLocation } from './storage.js';
import { selectHour } from './ui/timeline.js';
import { renderMoths, setViewMode } from './ui/moths.js';
import { openModal, closeModal, switchPhoto, openPhotoLightbox } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { openScoreSheet, closeScoreSheet } from './ui/conditions.js';
import { onExploreActivated, setExploreRadius, searchExplore, closeExploreSheet, filterForecastToRegion, drillDeeper, drillBack } from './ui/explore.js';
import { initMap, placeMarker, setEcoregionLayers, invalidateMapSize } from './map.js';
import { getCache, setCache, getCacheAge, getCacheStale } from './cache.js';
import { addSighting, removeSighting, removeSightingBySpec, getSightingsByDate, hasSighting, getTonightCount } from './sightings.js';

const FALLBACK_RADIUS_KM = 100;
let _sheetOpen = false;
let _moonPanelOpen = false;
let _filtersSheetOpen = false;
let _sheetMapInited = false;
let _neighbors = [];
let _myListDateKey = null; // null = date list view; YYYY-MM-DD string = detail view
let _lastSpeciesKey = null;
let _cacheAgeTimer = null;
// Species pagination
let _speciesLoading = false;
let _speciesSk = null;
let _speciesOpts = null;

window.__mothApp = {
  selectHour,
  openModal,
  closeModal,
  switchPhoto,
  openPhotoLightbox,
  openScoreSheet,
  closeScoreSheet,
  showToast,
  renderMoths,
  setViewMode,
  handleImgError: img => {
    const c = img.closest('.species-photo-top,.species-thumb,.modal-img');
    if (c) c.innerHTML = `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;
  },
  shareMoth,
  searchByText,
  geoLocate,
  toggleLocationSheet,
  toggleMoonPanel,
  switchTab,
  toggleTheme,
  openFiltersSheet: () => openFiltersSheet(),
  closeFiltersSheet: () => closeFiltersSheet(),
  applyFilters: () => applyFilters(),
  resetFilters: () => resetFilters(),
  setSortSeg: btn => setSortSeg(btn),
  openLightbox,
  logSighting,
  removeSighting: id => { removeSighting(id); renderMyList(); updateMyListBadge(); },
  openMyListDate: key => renderMyListDetail(key),
  closeMyListDetail: () => renderMyListDates(),
  openInatObs,
  setExploreRadius: btn => setExploreRadius(btn),
  searchExplore: () => searchExplore(),
  closeExploreSheet: () => closeExploreSheet(),
  filterForecastToRegion: () => filterForecastToRegion(),
  drillDeeper: () => drillDeeper(),
  drillBack: () => drillBack(),
  jumpToEcoregion: eco => jumpToEcoregion(eco),
  _switchNeighbor: idx => { const n = _neighbors[idx]; if (n) onNeighborClick(n.code, n.feature); },
  loadMoreSpecies: () => loadMoreSpecies(),
  ICONS,
  get _state() { return state; },
};

// ─── Keyboard / safe-area ────────────────────────────────────────
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const kbH = Math.max(0, window.innerHeight - window.visualViewport.height);
    document.documentElement.style.setProperty('--keyboard-h', `${kbH}px`);
    document.documentElement.classList.toggle('keyboard-open', kbH > 50);
  });
}

// ─── Theme ──────────────────────────────────────────────────────
const SUN_SVG  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;

function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const tog = document.getElementById('theme-toggle');
  const lbl = document.getElementById('theme-label');
  const ico = document.getElementById('theme-icon');
  if (tog) tog.checked = isDark;
  if (lbl) lbl.textContent = isDark ? 'Dark mode' : 'Light mode';
  if (ico) ico.outerHTML = (isDark ? MOON_SVG : SUN_SVG).replace('<svg ', '<svg id="theme-icon" ');
  // Keep native status-bar icons legible for both themes
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const plugin = window.Capacitor.Plugins.SafeArea;
      plugin?.setSystemBarsStyle?.({ style: isDark ? 'DARK' : 'LIGHT' });
    } catch {}
  }
}
function initTheme() { applyTheme(localStorage.getItem('moth_theme') !== 'light'); }
function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  applyTheme(!dark);
  localStorage.setItem('moth_theme', !dark ? 'dark' : 'light');
}

// ─── Status ────────────────────────────────────────────────────
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
  document.getElementById('result-count').textContent = '…';
  document.getElementById('results').innerHTML =
    '<div class="species-list">' + Array(3).fill('<div class="skeleton-card"></div>').join('') + '</div>';
}

// ─── Tab switching ──────────────────────────────────────────────
function switchTab(tab) {
  const tabs = ['forecast','identify','mylist','settings','explore'];
  for (const t of tabs) {
    const p = document.getElementById(`tab-${t}`);
    if (p) p.classList.toggle('active', t === tab);
    const d = document.getElementById(`di-${t}`);
    if (d) d.classList.toggle('active', t === tab);
    const b = document.getElementById(`bn-${t}`);
    if (b) b.classList.toggle('active', t === tab);
  }
  if (tab === 'mylist') renderMyList();
  if (tab === 'explore') onExploreActivated();
}

// ─── Filters sheet ─────────────────────────────────────────────
function openFiltersSheet() {
  _filtersSheetOpen = true;
  document.getElementById('filters-sheet').style.display = 'block';
  document.getElementById('filters-sheet-backdrop').style.display = 'block';
}

function closeFiltersSheet() {
  _filtersSheetOpen = false;
  document.getElementById('filters-sheet').style.display = 'none';
  document.getElementById('filters-sheet-backdrop').style.display = 'none';
}

function applyFilters() {
  renderMoths();
  updateFiltersBadge();
  closeFiltersSheet();
}

function resetFilters() {
  document.querySelectorAll('#sort-seg .filter-seg-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  const sortSel = document.getElementById('sort-sel');
  if (sortSel) sortSel.value = 'score';
  const habitatSel = document.getElementById('habitat-sel');
  if (habitatSel) habitatSel.value = '';
  const freqSel = document.getElementById('freq-sel');
  if (freqSel) freqSel.value = '';
  updateFiltersBadge();
  renderMoths();
  closeFiltersSheet();
}

function setSortSeg(btn) {
  document.querySelectorAll('#sort-seg .filter-seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sortSel = document.getElementById('sort-sel');
  if (sortSel) sortSel.value = btn.dataset.value;
  updateFiltersBadge();
}

function updateFiltersBadge() {
  const sortVal = document.getElementById('sort-sel')?.value;
  const habitatVal = document.getElementById('habitat-sel')?.value;
  const freqVal = document.getElementById('freq-sel')?.value;
  const ecoActive = document.getElementById('eco-sel')?.classList.contains('neighbor-active');
  const active = sortVal !== 'score' || !!habitatVal || !!freqVal || ecoActive;
  document.getElementById('filters-btn')?.classList.toggle('active', active);
}

function initFiltersSheetSwipe() {
  const sheet = document.getElementById('filters-sheet');
  let startY = 0;
  let swipeDelta = 0;

  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    swipeDelta = 0;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0 && sheet.scrollTop === 0) {
      swipeDelta = d;
      sheet.style.transform = `translateY(${d}px)`;
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (swipeDelta > 80) {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = 'translateY(110%)';
      setTimeout(() => { sheet.style.transform = ''; closeFiltersSheet(); }, 200);
    } else {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = '';
    }
  });
}

// ─── Moon panel ────────────────────────────────────────────────
function toggleMoonPanel() {
  _moonPanelOpen = !_moonPanelOpen;
  const panel = document.getElementById('moon-panel');
  const backdrop = document.getElementById('moon-panel-backdrop');
  panel.classList.toggle('open', _moonPanelOpen);
  backdrop.style.display = _moonPanelOpen ? 'block' : 'none';
  if (_moonPanelOpen) renderMoonPanel();
}

function renderMoonPanel() {
  const daily = state.forecastDaily || [];
  const today = new Date().toDateString();
  const container = document.getElementById('moon-panel-content');

  const fmtTime = iso => {
    if (!iso) return '–';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return '–'; }
  };

  // Tonight card
  const tonight = daily[0] || null;
  const phase = getMoonPhase();

  let rows = daily.slice(0, 7).map(d => {
    const date = new Date(d.y, d.mo - 1, d.d);
    const isToday = date.toDateString() === today;
    const dayName = isToday ? 'Tonight' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="moon-day-row ${isToday ? 'moon-today' : ''}">
      <div class="moon-day-phase"><span class="moon-day-svg">${moonPhaseSVG(d.moon.fraction)}</span></div>
      <div class="moon-day-info">
        <div class="moon-day-name">${dayName}</div>
        <div class="moon-day-phase-name">${d.moon.name} · ${d.moon.illum}%</div>
      </div>
      <div class="moon-day-times">
        <div class="moon-rise-set">↑ ${fmtTime(d.moonrise)}</div>
        <div class="moon-rise-set">↓ ${fmtTime(d.moonset)}</div>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="moon-panel-hero">
      <div class="moon-panel-icon">${moonPhaseSVG(phase.fraction)}</div>
      <div class="moon-panel-phase-name">${phase.name}</div>
      <div class="moon-panel-illum">${phase.illum}% illuminated</div>
      ${tonight ? `<div class="moon-panel-times">
        Rises ${fmtTime(tonight.moonrise)} · Sets ${fmtTime(tonight.moonset)}
      </div>` : ''}
    </div>
    <div class="moon-panel-sep"></div>
    <div class="moon-7day">${rows || '<div class="moon-no-data">Load a forecast to see 7-day moon data.</div>'}</div>
  `;
}

// ─── Lightbox ──────────────────────────────────────────────────
function openLightbox(src, alt) {
  if (!src) return;
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}" alt="${alt||''}" class="lightbox-img">
    <button class="lightbox-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// ─── Sighting log ──────────────────────────────────────────────
function logSighting(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;
  if (hasSighting(m.sci)) {
    removeSightingBySpec(m.sci);
    showToast(`${m.name} removed from My List`);
  } else {
    addSighting({
      speciesId: m.id,
      commonName: m.name,
      sciName: m.sci,
      location: state.currentName || '',
      lat: state.currentLat,
      lng: state.currentLng,
      ecoregion: state.ecoregion?.name || '',
      score: m.flightScore || 0,
    });
    showToast(`${m.name} logged to My List`);
  }
  updateMyListBadge();
  renderMoths();
  syncModalLogBtn(id);
}

function syncModalLogBtn(speciesId) {
  const btn = document.getElementById(`modal-log-btn-${speciesId}`);
  if (!btn) return;
  const m = state.allMoths.find(x => String(x.id) === String(speciesId));
  const logged = m ? hasSighting(m.sci) : false;
  btn.className = logged ? 'btn btn-logged modal-sticky-log' : 'btn btn-primary modal-sticky-log';
  btn.textContent = logged ? '✓ Logged' : '+ Log Sighting';
}

function updateMyListBadge() {
  const count = Object.keys(getSightingsByDate()).length;
  const badge = document.getElementById('mylist-badge');
  if (badge) badge.style.display = count > 0 ? 'block' : 'none';
}

// ─── My List ──────────────────────────────────────────────────
function mlFmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function mlSetHeader(html) {
  const el = document.getElementById('mylist-header');
  if (el) el.innerHTML = html;
}

function renderMyList() {
  if (_myListDateKey) renderMyListDetail(_myListDateKey);
  else renderMyListDates();
}

function renderMyListDates() {
  _myListDateKey = null;
  mlSetHeader(`
    <div class="mylist-heading">My List</div>
    <div class="mylist-subhead">Tonight's sightings · Tap + on any species card to log</div>
  `);

  const container = document.getElementById('mylist-content');
  if (!container) return;

  const byDate = getSightingsByDate();
  const dateKeys = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // newest first

  if (!dateKeys.length) {
    container.innerHTML = `<div class="mylist-empty">No sightings yet. Tap + on any species to log it.</div>`;
    return;
  }

  container.innerHTML = dateKeys.map(dk => {
    const entries = byDate[dk];
    const d = new Date(dk + 'T12:00:00'); // noon avoids timezone edge cases
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const location = entries.find(s => s.location)?.location || entries.find(s => s.ecoregion)?.ecoregion || '';
    const firstCoord = entries.find(s => s.lat != null && s.lng != null);
    const coordStr = firstCoord
      ? `${Math.abs(firstCoord.lat).toFixed(4)}° ${firstCoord.lat >= 0 ? 'N' : 'S'}, ${Math.abs(firstCoord.lng).toFixed(4)}° ${firstCoord.lng >= 0 ? 'E' : 'W'}`
      : '';
    const timestamps = entries.map(s => s.timestamp).filter(Boolean);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const timeRange = timestamps.length > 1 && minTs !== maxTs
      ? `${mlFmtTime(minTs)} – ${mlFmtTime(maxTs)}`
      : timestamps.length ? mlFmtTime(minTs) : entries[0].time || '';
    const speciesCount = new Set(entries.map(s => s.sciName)).size;
    return `<button class="mylist-date-card" onclick="window.__mothApp.openMyListDate('${dk}')">
      <div class="mylist-date-card-body">
        <div class="mylist-date-label">${label}</div>
        ${location ? `<div class="mylist-date-location">${location}</div>` : ''}
        ${coordStr ? `<div class="mylist-date-coords">${coordStr}</div>` : ''}
        <div class="mylist-date-meta">
          <span>${timeRange}</span>
          <span class="mylist-date-count">${speciesCount} species</span>
        </div>
      </div>
      <span class="mylist-date-chevron">›</span>
    </button>`;
  }).join('');
}

function renderMyListDetail(dateKey) {
  _myListDateKey = dateKey;

  const byDate = getSightingsByDate();
  const entries = byDate[dateKey];
  if (!entries?.length) { renderMyListDates(); return; }

  const d = new Date(dateKey + 'T12:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const BACK_CHEV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>`;
  mlSetHeader(`
    <button class="mylist-back-btn" onclick="window.__mothApp.closeMyListDetail()">
      ${BACK_CHEV}<span>Back</span>
    </button>
    <div class="mylist-detail-date">${label}</div>
  `);

  // Push history state so Android back button works
  if (history.state?.mylistDetail !== dateKey) {
    history.pushState({ mylistDetail: dateKey }, '');
  }

  const TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  // Deduplicate by sciName, keep earliest entry per species
  const seen = new Set();
  const unique = entries
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .filter(s => { if (seen.has(s.sciName)) return false; seen.add(s.sciName); return true; });

  const container = document.getElementById('mylist-content');
  if (!container) return;
  container.innerHTML = unique.map(s => `
    <div class="mylist-entry">
      <div class="mylist-info">
        <div class="mylist-name">${s.commonName || s.name || ''}</div>
        <div class="mylist-sci">${s.sciName || s.sci || ''}</div>
        <div class="mylist-meta">${s.time || mlFmtTime(s.timestamp || 0)} · ${s.score || 0}% flight likelihood</div>
      </div>
      <div class="mylist-actions">
        <button class="mylist-del" onclick="window.__mothApp.removeSighting('${s.id}')" aria-label="Delete">${TRASH}</button>
      </div>
    </div>
  `).join('');

  // Swipe right → back
  let _sx = 0;
  container.addEventListener('touchstart', e => { _sx = e.touches[0].clientX; }, { passive: true });
  container.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientX - _sx > 60) window.__mothApp.closeMyListDetail();
  }, { passive: true });
}

// Android back button intercept
window.addEventListener('popstate', () => {
  if (_myListDateKey) renderMyListDates();
});

// ─── iNaturalist integration ────────────────────────────────────
function openInatObs(inatId, sci) {
  const sciEncoded = encodeURIComponent(sci);
  const webUrl = `https://www.inaturalist.org/observations/new?taxon_name=${sciEncoded}`;

  if (!window.Capacitor?.isNativePlatform?.() || window.Capacitor.getPlatform?.() !== 'android') {
    window.open(webUrl, '_blank', 'noopener');
    return;
  }

  // Cancel the fallback chain the moment the page goes to background
  // (meaning step 1 or 2 successfully launched the app)
  let t2, t3;
  const cancelAll = () => { clearTimeout(t2); clearTimeout(t3); };
  document.addEventListener('visibilitychange', function onBg() {
    if (document.hidden) {
      cancelAll();
      document.removeEventListener('visibilitychange', onBg);
    }
  });

  // Step 1 — intent deep link into the installed app
  window.location.href =
    `intent://www.inaturalist.org/observations/new?taxon_name=${sciEncoded}` +
    `#Intent;scheme=https;package=org.inaturalist.android;end`;

  // Step 2 — custom URI scheme (if intent wasn't handled after 1 s)
  t2 = setTimeout(() => {
    window.location.href = `org.inaturalist.android://observations/new?taxon_name=${sciEncoded}`;

    // Step 3 — web fallback (if custom scheme also went nowhere after 600 ms)
    t3 = setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener');
    }, 600);
  }, 1000);
}

// ─── Location sheet ────────────────────────────────────────────
function toggleLocationSheet(force) {
  _sheetOpen = force !== undefined ? !!force : !_sheetOpen;
  document.getElementById('location-sheet').style.display = _sheetOpen ? 'block' : 'none';
  document.getElementById('sheet-backdrop').style.display = _sheetOpen ? 'block' : 'none';
  if (_sheetOpen) {
    setTimeout(() => { const i = document.getElementById('loc-input'); i.focus(); i.setSelectionRange(0,0); }, 60);
    if (!_sheetMapInited) {
      _sheetMapInited = true;
      initMap(state.currentLat || 41.3, state.currentLng || -105.6, onMapPick);
      if (state.ecoregion) setEcoregionLayers(state.ecoregion.feature, [], () => {});
    }
    setTimeout(() => invalidateMapSize(), 200);
  }
}

async function onMapPick(lat, lng) {
  placeMarker(lat, lng, false);
  setStatus('Detecting location…');
  try {
    const name = await reverseGeocode(lat, lng);
    document.getElementById('loc-input').value = name;
    fetchAll(lat, lng, name);
  } catch { setStatus('Could not detect location. Try searching.', true); }
}

// ─── Ecoregion UI ─────────────────────────────────────────────
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
  _neighbors.slice(0, 8).forEach((n, i) => { html += `<option value="n${i}">${esc(n.name)}</option>`; });
  sel.innerHTML = html;
  sel.disabled = false;
  sel.value = 'current';
  sel.classList.remove('neighbor-active');
  updateFiltersBadge();
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('eco-sel').addEventListener('change', function() {
  if (this.value === 'current') {
    this.classList.remove('neighbor-active');
    updateFiltersBadge();
    if (state.ecoregion) onNeighborClick(state.ecoregion.code, state.ecoregion.feature);
  } else {
    const n = _neighbors[parseInt(this.value.replace('n',''),10)];
    if (n) { this.classList.add('neighbor-active'); updateFiltersBadge(); onNeighborClick(n.code, n.feature); }
  }
});

async function onNeighborClick(code, feature) {
  const eco = {
    code, name: feature.properties.US_L4NAME, l3name: feature.properties.US_L3NAME,
    l2name: feature.properties.NA_L2NAME, l1name: feature.properties.NA_L1NAME,
    bbox: getBboxFromFeature(feature), feature,
  };
  state.ecoregion = eco;
  setLocationLabel(eco.name);
  setStatus(`Switching to ${eco.name}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';

  const [mothData, neighbors] = await Promise.all([
    fetchSpeciesForEco(eco),
    fetchNeighboringEcoregions(eco.bbox, eco.code),
  ]);
  updateEcoSelect(eco, neighbors);
  document.getElementById('conditions-section').style.display = 'block';
  if (!mothData?.length) {
    setStatus(`No moth records in ${eco.name} for this time of year.`);
    document.getElementById('results').innerHTML = `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No records found.</div>`;
    return;
  }
  // allMoths already set by fetchSpeciesForEco
  setStatus('');
  renderMoths();
  updateMyListBadge();
}

function getBboxFromFeature(feature) {
  const pts = [];
  const walk = c => typeof c[0]==='number' ? pts.push(c) : c.forEach(walk);
  walk(feature.geometry.coordinates);
  return {
    swlat: Math.min(...pts.map(p=>p[1])), swlng: Math.min(...pts.map(p=>p[0])),
    nelat: Math.max(...pts.map(p=>p[1])), nelng: Math.max(...pts.map(p=>p[0])),
  };
}

// ─── Species fetch with cache ─────────────────────────────────
async function fetchSpeciesForEco(ecoObj) {
  const opts = { bbox: ecoObj.bbox };
  const sk = speciesKey({ bbox: ecoObj.bbox, _lat: state.currentLat, _lng: state.currentLng });

  // Full cache hit (all pages previously loaded)
  const cached = getCache('species', sk);
  if (cached?.length) {
    state.allMoths = cached;
    state.speciesPage = -1;
    state.speciesTotalAPI = cached.length;
    state.speciesAllLoaded = true;
    showCacheAge(sk);
    return cached;
  }

  // Start paginated load (page 1)
  _initSpeciesPagination(sk, opts);
  const result = await fetchSpeciesPage(state.currentLat, state.currentLng, opts, 1);
  if (!result?.species?.length) return null;

  state.allMoths = result.species;
  state.speciesPage = 1;
  state.speciesTotalAPI = result.total;
  state.speciesAllLoaded = !result.hasMore;
  if (state.speciesAllLoaded) { setCache('species', sk, state.allMoths); showCacheAge(sk); }
  return state.allMoths;
}

// Switches to Forecast tab and loads species for the given ecoregion.
// Called from the Explore tab "Filter Forecast to this region" action.
async function jumpToEcoregion(ecoObj) {
  state.ecoregion = ecoObj;
  switchTab('forecast');
  setLocationLabel(ecoObj.name);
  setStatus(`Loading species for ${ecoObj.name}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';

  const [mothData, neighbors] = await Promise.all([
    fetchSpeciesForEco(ecoObj),
    fetchNeighboringEcoregions(ecoObj.bbox, ecoObj.code),
  ]);
  updateEcoSelect(ecoObj, neighbors);
  document.getElementById('conditions-section').style.display = 'block';

  if (!mothData?.length) {
    setStatus(`No moth records in ${ecoObj.name} for this time of year.`);
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No records found.</div>`;
    return;
  }
  // allMoths already set by fetchSpeciesForEco
  setStatus('');
  renderMoths();
}

// ─── Species pagination ───────────────────────────────────────
function _initSpeciesPagination(sk, opts) {
  _speciesSk = sk;
  _speciesOpts = opts;
  _speciesLoading = false;
  state.allMoths = [];
  state.speciesPage = 0;
  state.speciesTotalAPI = null;
  state.speciesAllLoaded = false;
  resetSpeciesPagination();
}

function _mergeNewSpecies(incoming) {
  const seen = new Set(state.allMoths.map(m => (m.sci || '').toLowerCase().trim()));
  return incoming.filter(m => !seen.has((m.sci || '').toLowerCase().trim()));
}

async function _loadSpeciesPage() {
  if (_speciesLoading || state.speciesAllLoaded || !_speciesSk) return;
  _speciesLoading = true;
  const page = state.speciesPage + 1;
  try {
    const result = await fetchSpeciesPage(state.currentLat, state.currentLng, _speciesOpts, page);
    const newSpecies = _mergeNewSpecies(result.species || []);
    state.allMoths = [...state.allMoths, ...newSpecies];
    state.speciesPage = page;
    if (result.total != null) state.speciesTotalAPI = result.total;
    state.speciesAllLoaded = !result.hasMore;
    if (state.speciesAllLoaded && _speciesSk) {
      setCache('species', _speciesSk, state.allMoths);
      showCacheAge(_speciesSk);
    }
    renderMoths();
  } catch(e) {
    state.speciesAllLoaded = false;
    renderMoths();
  } finally {
    _speciesLoading = false;
  }
}

async function loadMoreSpecies() {
  if (_speciesLoading || state.speciesAllLoaded) return;
  // Optimistically update button before async work
  const btn = document.getElementById('species-load-more-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  await _loadSpeciesPage();
}

// ─── Cache helpers ────────────────────────────────────────────
function geoKey(lat, lng) {
  return `${Math.round(lat * 10)}_${Math.round(lng * 10)}`;
}
function speciesKey(opts) {
  return opts.bbox
    ? `eco_${Math.round(opts.bbox.swlat * 10)}_${Math.round(opts.bbox.swlng * 10)}`
    : `rad_${Math.round(opts._lat * 10)}_${Math.round(opts._lng * 10)}`;
}
function showCacheAge(sk) {
  _lastSpeciesKey = sk;
  _updateCacheAgeDisplay();
  if (!_cacheAgeTimer) _cacheAgeTimer = setInterval(_updateCacheAgeDisplay, 60000);
}

function _updateCacheAgeDisplay() {
  const el = document.getElementById('cache-age-note');
  if (!el || !_lastSpeciesKey) return;
  const ageMs = getCacheAge('species', _lastSpeciesKey);
  if (!ageMs) { el.style.display = 'none'; return; }
  const ageMin = Math.round(ageMs / 60000);
  let text;
  if (ageMs < 60000) text = 'Updated just now';
  else if (ageMin < 60) text = `Updated ${ageMin}m ago`;
  else if (ageMin < 1440) text = `Updated ${Math.round(ageMin / 60)}h ago`;
  else text = 'Updated yesterday';
  el.textContent = text;
  el.style.display = 'block';
}

// ─── Main fetch ───────────────────────────────────────────────
async function fetchAll(lat, lng, locationName) {
  resetSpeciesPagination();
  clearGBIFCache();
  state.speciesPage = 1;
  state.speciesAllLoaded = false;
  state.speciesTotalAPI = 0;
  state.allMoths = [];
  state.currentLat = lat;
  state.currentLng = lng;
  state.currentName = locationName;
  saveLocation(lat, lng, locationName);
  setLocationLabel(locationName);
  toggleLocationSheet(false);

  const gk = geoKey(lat, lng);

  // Serve full UI from cache instantly if all three caches are warm
  const cachedEco    = getCacheStale('ecoregion', gk);
  const cachedHours  = cachedEco ? getCacheStale('weather', gk) : null;
  const qOpts        = cachedEco
    ? { bbox: cachedEco.bbox }
    : { radiusKm: FALLBACK_RADIUS_KM, _lat: lat, _lng: lng };
  const sk           = speciesKey({ ...qOpts, _lat: lat, _lng: lng });
  const cachedMoths  = getCacheStale('species', sk);

  if (cachedEco && cachedHours?.length && cachedMoths?.length) {
    state.ecoregion = cachedEco;
    state.forecastHours = cachedHours;
    state.nowIndex = findNowIndex(cachedHours);
    state.peakIndex = findPeakIndex(cachedHours, state.nowIndex);
    state.allMoths = cachedMoths;
    state.speciesPage = -1;
    state.speciesTotalAPI = cachedMoths.length;
    state.speciesAllLoaded = true;
    document.getElementById('timeline-section').style.display = 'block';
    selectHour(state.peakIndex);
    document.getElementById('controls-section').style.display = 'block';
    updateEcoSelect(cachedEco, []);
    renderMoths();
    updateMyListBadge();
    showCacheAge(sk);
    setStatus('');
    // Silent background refresh of weather
    if (!getCache('weather', gk)) {
      fetchForecast(lat, lng).then(hours => {
        if (!hours?.length) return;
        setCache('weather', gk, hours);
        state.forecastHours = hours;
        state.nowIndex = findNowIndex(hours);
        state.peakIndex = findPeakIndex(hours, state.nowIndex);
        selectHour(state.peakIndex);
      }).catch(() => {});
    }
    // Silent background re-paginate species if cache is stale
    if (!getCache('species', sk)) {
      _initSpeciesPagination(sk, qOpts);
      state.allMoths = cachedMoths; // keep stale data visible
      state.speciesAllLoaded = true; // hide load-more while refreshing
      _loadSpeciesPage().catch(() => {});
    }
    return;
  }

  // Full loading path — show first page immediately
  setStatus(`Loading forecast for ${locationName}…`);
  showSkeletons();
  document.getElementById('conditions-section').style.display = 'none';
  document.getElementById('timeline-section').style.display = 'none';
  updateEcoSelect(null, []);
  document.getElementById('cache-age-note').style.display = 'none';

  // Ecoregion
  let ecoData = getCache('ecoregion', gk);
  if (!ecoData) {
    ecoData = await fetchEcoregionAtPoint(lat, lng);
    if (ecoData) setCache('ecoregion', gk, ecoData);
  }
  state.ecoregion = ecoData;

  if (_sheetMapInited && ecoData) {
    placeMarker(lat, lng, false);
    setEcoregionLayers(ecoData.feature, [], () => {});
  }

  // Weather
  let hours = getCache('weather', gk);
  if (!hours) {
    hours = await fetchForecast(lat, lng);
    if (hours?.length) setCache('weather', gk, hours);
  }

  const queryOpts = ecoData ? { bbox: ecoData.bbox } : { radiusKm: FALLBACK_RADIUS_KM, _lat: lat, _lng: lng };
  const sKey = speciesKey({ ...queryOpts, _lat: lat, _lng: lng });

  // Check for full species cache
  const cachedSpecies = getCache('species', sKey);

  // Fetch habitat, neighbors, moon in parallel with species page 1
  _initSpeciesPagination(sKey, queryOpts);
  const [firstPage, habitatData, neighbors, moonDaily] = await Promise.all([
    cachedSpecies?.length ? Promise.resolve(null) : fetchSpeciesPage(lat, lng, queryOpts, 1),
    fetchHabitat(lat, lng, ecoData ? 50 : FALLBACK_RADIUS_KM),
    ecoData ? fetchNeighboringEcoregions(ecoData.bbox, ecoData.code) : Promise.resolve([]),
    fetchMoonData(lat, lng),
  ]);

  if (cachedSpecies?.length) {
    state.allMoths = cachedSpecies;
    state.speciesPage = -1;
    state.speciesTotalAPI = cachedSpecies.length;
    state.speciesAllLoaded = true;
    showCacheAge(sKey);
  } else if (firstPage?.species?.length) {
    state.allMoths = firstPage.species;
    state.speciesPage = 1;
    state.speciesTotalAPI = firstPage.total;
    state.speciesAllLoaded = !firstPage.hasMore;
    if (state.speciesAllLoaded) { setCache('species', sKey, state.allMoths); showCacheAge(sKey); }
  }

  state.habitat = habitatData;
  state.forecastDaily = moonDaily || [];
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

  if (!state.allMoths.length) {
    setStatus('');
    const area = ecoData ? `the ${ecoData.name} ecoregion` : `within ${FALLBACK_RADIUS_KM}km`;
    document.getElementById('results').innerHTML =
      `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No moth records found in ${area} for this time of year.</div>`;
    document.getElementById('controls-section').style.display = 'none';
    return;
  }

  setStatus('');
  document.getElementById('controls-section').style.display = 'block';
  renderMoths();
  updateMyListBadge();
  if (!state.speciesAllLoaded) showCacheAge(sKey);
}

// ─── Search / geolocation ─────────────────────────────────────
async function searchByText() {
  const q = document.getElementById('loc-input').value.trim();
  if (!q) return;
  setStatus('Looking up location…');
  try {
    const r = await geocodeText(q);
    if (!r) { setStatus('Location not found. Try a city or region.', true); return; }
    document.getElementById('loc-input').value = r.name;
    fetchAll(r.lat, r.lng, r.name);
  } catch { setStatus('Could not look up location. Try again.', true); }
}

async function geoLocate() {
  if (!navigator.geolocation) { setStatus('GPS not available — search by city name', true); toggleLocationSheet(true); return; }
  setStatus('Getting GPS location…');
  try {
    const { lat, lng } = await getBrowserLocation();
    const name = await reverseGeocode(lat, lng);
    document.getElementById('loc-input').value = name;
    fetchAll(lat, lng, name);
  } catch { setStatus('GPS unavailable — enter a city or region to continue', true); toggleLocationSheet(true); }
}

// ─── Share ──────────────────────────────────────────────────
function shareMoth(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;
  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const url = inatId ? `https://www.inaturalist.org/taxa/${inatId}` : `https://www.gbif.org/species/${m.gbifKey}`;
  const where = state.ecoregion ? state.ecoregion.name : state.currentName || 'this location';
  const text = `Check out the ${m.name} — a moth flying in the ${where}!\n${url}`;
  if (navigator.share) navigator.share({ title: m.name, text, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast('Link copied'));
  else showToast('Copy unavailable');
}

// ─── Init ─────────────────────────────────────────────────────
// Moon icon — innerHTML only; click is handled by parent .home-btn button
document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(getMoonPhase().fraction);

document.getElementById('loc-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchByText(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); toggleLocationSheet(false);
    if (_filtersSheetOpen) closeFiltersSheet();
    if (_moonPanelOpen) toggleMoonPanel();
  }
});

// ─── Location sheet swipe-down dismiss ────────────────────────
function initLocationSheetSwipe() {
  const sheet = document.getElementById('location-sheet');
  let startY = 0;
  let swipeDelta = 0;

  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    swipeDelta = 0;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0 && sheet.scrollTop === 0) {
      swipeDelta = d;
      sheet.style.transform = `translateY(${d}px)`;
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (swipeDelta > 80) {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = 'translateY(110%)';
      setTimeout(() => { sheet.style.transform = ''; toggleLocationSheet(false); }, 200);
    } else {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = '';
    }
  });
}

// ─── Pull-to-refresh ──────────────────────────────────────────
function initPullToRefresh() {
  const container = document.getElementById('tab-forecast');
  container.style.overscrollBehavior = 'none';

  const REFRESH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.innerHTML = `<span id="ptr-icon">${REFRESH_SVG}</span>`;
  document.body.appendChild(indicator);

  const PTR_START = 20, PTR_FULL = 60, MAX_CONTENT_SHIFT = 40;
  const DAMP = MAX_CONTENT_SHIFT / PTR_FULL;
  let startY = 0, startX = 0, pullDy = 0, intentV = null;
  let ptrEnabled = false, pulling = false, ptrReady = false;

  function icon() { return document.getElementById('ptr-icon'); }

  function snapContent(animate = true) {
    if (animate) {
      container.style.transition = 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)';
      setTimeout(() => { container.style.transition = ''; }, 300);
    }
    container.style.transform = '';
  }

  container.addEventListener('touchstart', e => {
    ptrEnabled = container.classList.contains('active') && window.scrollY <= 5;
    if (!ptrEnabled) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    pullDy = 0; intentV = null; pulling = false; ptrReady = false;
    container.style.transition = 'none';
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (!ptrEnabled) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (intentV === null && (Math.abs(dy) > 8 || Math.abs(dx) > 8)) {
      intentV = Math.abs(dy) > Math.abs(dx);
    }
    if (!intentV || dy <= 0) return;
    e.preventDefault();
    pullDy = dy;
    pulling = true;

    if (pullDy >= PTR_FULL) {
      // Phase 2 — ready, lock everything
      if (!ptrReady) {
        ptrReady = true;
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateX(-50%) scale(1)';
        const ic = icon();
        ic.style.transform = '';
        ic.classList.add('ptr-ready');
      }
      container.style.transform = `translateY(${MAX_CONTENT_SHIFT}px)`;
    } else {
      // Phase 1 — follow finger proportionally
      ptrReady = false;
      const ic = icon();
      ic.classList.remove('ptr-ready');
      const progress = Math.max(0, (pullDy - PTR_START) / (PTR_FULL - PTR_START));
      indicator.style.opacity = String(progress);
      indicator.style.transform = `translateX(-50%) scale(${0.4 + progress * 0.6})`;
      ic.style.transform = `rotate(${progress * 45}deg)`;
      container.style.transform = `translateY(${pullDy * DAMP}px)`;
    }
  }, { passive: false });

  container.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    snapContent(true);

    if (pullDy >= PTR_FULL) {
      // Phase 3 — refreshing
      const ic = icon();
      ic.classList.remove('ptr-ready');
      ic.style.transform = '';
      ic.classList.add('spinning');
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateX(-50%) scale(1)';
      indicator.style.transition = 'none';
      if (state.currentLat != null && state.currentLng != null) {
        try { await fetchAll(state.currentLat, state.currentLng, state.currentName || ''); }
        catch { /* non-fatal */ }
      }
      // Phase 4 — complete
      ic.classList.remove('spinning');
      indicator.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(-50%) scale(0.8)';
      setTimeout(() => { indicator.style.transition = ''; ic.style.transform = ''; }, 300);
    } else {
      // Abort
      icon().classList.remove('ptr-ready');
      icon().style.transform = '';
      indicator.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(-50%) scale(0)';
      setTimeout(() => { indicator.style.transition = ''; }, 200);
    }
    pullDy = 0;
    ptrReady = false;
  }, { passive: true });
}

// ─── Moon panel swipe-down dismiss ────────────────────────────
function initMoonPanelSwipe() {
  const panel = document.getElementById('moon-panel');
  let startY = 0, swipeDelta = 0;
  panel.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    swipeDelta = 0;
    panel.style.transition = 'none';
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0 && panel.scrollTop === 0) {
      swipeDelta = d;
      panel.style.transform = `translateY(${d}px)`;
    }
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (swipeDelta > 80) {
      panel.style.transition = 'transform 0.2s ease';
      panel.style.transform = 'translateY(110%)';
      setTimeout(() => {
        panel.style.transform = '';
        panel.style.transition = '';
        _moonPanelOpen = false;
        panel.classList.remove('open');
        document.getElementById('moon-panel-backdrop').style.display = 'none';
      }, 200);
    } else {
      panel.style.transition = '';  // restore CSS transition for snap-back
      panel.style.transform = '';
    }
  });
}

// ─── Android native back button ───────────────────────────────
// MainActivity.java fires triggerWindowJSEvent("backButton", "{}") via the
// Capacitor bridge, which dispatches a native CustomEvent on window.
function initBackButton() {
  window.addEventListener('backButton', () => {
    // Dismiss the most transient overlay first, then navigate up the hierarchy.
    if (_sheetOpen)                               { toggleLocationSheet(false); return; }
    if (_filtersSheetOpen)                        { closeFiltersSheet();        return; }
    if (_moonPanelOpen)                           { toggleMoonPanel();          return; }
    if (document.querySelector('.modal-overlay')) { closeModal();               return; }
    if (_myListDateKey)                           { renderMyListDates();        return; }

    if (document.getElementById('explore-region-sheet')?.style.display !== 'none') { closeExploreSheet(); return; }

    // Non-forecast tab → return to forecast
    const nonForecastActive = ['identify', 'mylist', 'settings', 'explore'].some(t =>
      document.getElementById(`tab-${t}`)?.classList.contains('active')
    );
    if (nonForecastActive) { switchTab('forecast'); return; }

    // Already on forecast with nothing open → exit via history or App plugin
    if (window.history.length > 1) {
      window.history.back();
    } else {
      const CapApp = window.Capacitor?.Plugins?.App;
      if (CapApp?.exitApp) CapApp.exitApp();
    }
  });
}

// ─── Safe area — runtime Capacitor WindowInsets ───────────────
function initSafeArea() {
  // Probe a fixed element to convert env() to computed px values.
  // The @capacitor-community/safe-area plugin ensures env(safe-area-inset-*)
  // reflects real Android WindowInsets on all Chromium versions it supports.
  try {
    const probe = document.createElement('div');
    probe.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none',
      'visibility:hidden', 'z-index:-1',
      'padding-top:env(safe-area-inset-top,0px)',
      'padding-bottom:env(safe-area-inset-bottom,0px)',
    ].join(';');
    document.documentElement.appendChild(probe);
    const cs = window.getComputedStyle(probe);
    const statusH = parseFloat(cs.paddingTop) || 0;
    const navH = parseFloat(cs.paddingBottom) || 0;
    document.documentElement.removeChild(probe);
    if (statusH > 0) document.documentElement.style.setProperty('--status-bar-height', `${statusH}px`);
    if (navH > 0) document.documentElement.style.setProperty('--nav-bar-height', `${navH}px`);
  } catch {}
}
initSafeArea();
initLocationSheetSwipe();
initFiltersSheetSwipe();
initMoonPanelSwipe();
initPullToRefresh();
initBackButton();

initTheme();
updateMyListBadge();

const saved = loadSavedLocation();
if (saved) { setLocationLabel(saved.name); document.getElementById('loc-input').value = saved.name; fetchAll(saved.lat, saved.lng, saved.name); }
else geoLocate();

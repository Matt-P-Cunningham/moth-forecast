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
import { getCache, setCache, getCacheAge } from './cache.js';
import { addSighting, deleteSighting, getSightingsGroupedByDate, hasSighting, getTonightCount } from './sightings.js';
import { CHARACTERS, runKey } from './identify.js';

const FALLBACK_RADIUS_KM = 100;
let _sheetOpen = false;
let _drawerOpen = false;
let _moonPanelOpen = false;
let _sheetMapInited = false;
let _neighbors = [];
let _identifyAnswers = {};
let _identifyStep = 0;

window.__mothApp = {
  selectHour,
  openModal,
  closeModal,
  showToast,
  renderMoths,
  handleImgError: img => {
    const c = img.closest('.species-photo,.modal-img');
    if (c) c.innerHTML = `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;
  },
  shareMoth,
  searchByText,
  geoLocate,
  toggleLocationSheet,
  toggleDrawer,
  toggleMoonPanel,
  switchTab,
  toggleTheme,
  openLightbox,
  logSighting,
  deleteSighting: uid => { deleteSighting(uid); renderMyList(); updateMyListBadge(); },
  identifyAnswer,
  identifySkip,
  identifyReset,
  openInatObs,
  _switchNeighbor: idx => { const n = _neighbors[idx]; if (n) onNeighborClick(n.code, n.feature); },
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
  document.getElementById('results').innerHTML =
    '<div class="species-list">' + Array(8).fill('<div class="skeleton-card"></div>').join('') + '</div>';
}

// ─── Tab switching ──────────────────────────────────────────────
function switchTab(tab) {
  const tabs = ['forecast','identify','mylist','settings'];
  for (const t of tabs) {
    const p = document.getElementById(`tab-${t}`);
    if (p) p.classList.toggle('active', t === tab);
    const d = document.getElementById(`di-${t}`);
    if (d) d.classList.toggle('active', t === tab);
  }
  if (tab === 'mylist') renderMyList();
  if (tab === 'identify') renderIdentifyStep();
  if (_drawerOpen) toggleDrawer();
}

// ─── Drawer ────────────────────────────────────────────────────
function toggleDrawer() {
  _drawerOpen = !_drawerOpen;
  document.getElementById('drawer').classList.toggle('open', _drawerOpen);
  document.getElementById('drawer-backdrop').classList.toggle('open', _drawerOpen);
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
  addSighting({
    id: m.id,
    inatId: m.inatId || (m.source !== 'gbif' ? m.id : null),
    name: m.name,
    sci: m.sci,
    photoUrl: m.photo?.url,
    score: m.flightScore || 0,
    lat: state.currentLat,
    lng: state.currentLng,
    ecoregion: state.ecoregion?.name || '',
  });
  showToast(`${m.name} logged to My List`);
  updateMyListBadge();
  renderMoths(); // refresh + buttons → checkmarks
}

function updateMyListBadge() {
  const count = getTonightCount();
  const badge = document.getElementById('mylist-badge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function renderMyList() {
  const container = document.getElementById('mylist-content');
  if (!container) return;
  const groups = getSightingsGroupedByDate();
  const dates = Object.keys(groups);
  if (!dates.length) {
    container.innerHTML = `<div class="stub-state">
      <span class="stub-icon">${ICONS.moon}</span>
      <h2>No sightings yet</h2>
      <p>Tap the <strong>+</strong> button on any species card to log a sighting tonight.</p>
    </div>`;
    return;
  }
  container.innerHTML = dates.map(date => `
    <div class="mylist-group">
      <div class="mylist-date-header">${date}</div>
      ${groups[date].map(s => `
        <div class="mylist-entry">
          ${s.photoUrl ? `<img class="mylist-thumb" src="${s.photoUrl}" alt="${s.name}">` : `<div class="mylist-thumb mylist-thumb-empty">${ICONS.mothSilhouette}</div>`}
          <div class="mylist-info">
            <div class="mylist-name">${s.name}</div>
            <div class="mylist-sci">${s.sci}</div>
            <div class="mylist-meta">${new Date(s.ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}${s.ecoregion ? ' · ' + s.ecoregion : ''}</div>
          </div>
          <div class="mylist-actions">
            ${s.inatId ? `<button class="mylist-inat-btn" onclick="window.__mothApp.openInatObs('${s.inatId}','${s.sci}')" title="Log on iNaturalist">iNat</button>` : ''}
            <button class="mylist-del" onclick="window.__mothApp.deleteSighting('${s.uid}')" aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// ─── iNaturalist integration ────────────────────────────────────
function openInatObs(inatId, sci) {
  const url = inatId
    ? `https://www.inaturalist.org/observations/new?taxon_id=${inatId}`
    : `https://www.inaturalist.org/observations/new?taxon_name=${encodeURIComponent(sci)}`;
  window.open(url, '_blank', 'noopener');
}

// ─── Identify key ──────────────────────────────────────────────
function renderIdentifyStep() {
  const container = document.getElementById('identify-content');
  if (!container) return;
  const char = CHARACTERS[_identifyStep];
  if (!char) { renderIdentifyResults(); return; }

  const MOTH_DIAGRAMS = {
    forewing: `<svg viewBox="0 0 200 120" class="moth-diagram">
      <ellipse cx="100" cy="60" rx="8" ry="22" fill="var(--text2)" opacity=".8"/>
      <path d="M100 48 C70 30 20 20 10 40 C5 55 30 75 100 72Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1.5"/>
      <path d="M100 60 C80 70 30 80 15 70 C5 65 20 85 100 80Z" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1"/>
      <path d="M100 48 C130 30 180 20 190 40 C195 55 170 75 100 72Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1.5" opacity=".5"/>
      <text x="55" y="52" fill="var(--accent-text)" font-size="10" font-weight="700">← forewing →</text>
    </svg>`,
    hindwing: `<svg viewBox="0 0 200 120" class="moth-diagram">
      <ellipse cx="100" cy="60" rx="8" ry="22" fill="var(--text2)" opacity=".8"/>
      <path d="M100 48 C70 30 20 20 10 40 C5 55 30 75 100 72Z" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1" opacity=".5"/>
      <path d="M100 60 C80 70 30 80 15 70 C5 65 20 85 100 80Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1.5"/>
      <text x="30" y="95" fill="var(--accent-text)" font-size="10" font-weight="700">← hindwing →</text>
    </svg>`,
    antenna: `<svg viewBox="0 0 200 120" class="moth-diagram">
      <circle cx="100" cy="70" r="18" fill="var(--surface2)" stroke="var(--border2)" stroke-width="1.5"/>
      <line x1="89" y1="54" x2="55" y2="15" stroke="var(--text2)" stroke-width="3" stroke-linecap="round"/>
      <line x1="111" y1="54" x2="145" y2="15" stroke="var(--text2)" stroke-width="3" stroke-linecap="round"/>
      <text x="20" y="30" fill="var(--text2)" font-size="9">feathered?</text>
      <text x="128" y="30" fill="var(--text2)" font-size="9">or filiform?</text>
    </svg>`,
    posture: `<svg viewBox="0 0 200 120" class="moth-diagram">
      <text x="10" y="30" fill="var(--text2)" font-size="10" font-weight="600">Flat</text>
      <path d="M10 50 C40 35 60 35 70 50 C60 65 40 65 10 50Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1"/>
      <text x="85" y="30" fill="var(--text2)" font-size="10" font-weight="600">Tent</text>
      <path d="M90 60 L110 30 L130 60Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1" stroke-linejoin="round"/>
      <text x="150" y="30" fill="var(--text2)" font-size="10" font-weight="600">Angled</text>
      <path d="M155 55 C170 35 185 30 190 40 L175 60Z" fill="var(--accent-bg)" stroke="var(--accent)" stroke-width="1"/>
    </svg>`,
  };

  const diagram = MOTH_DIAGRAMS[char.diagram] || MOTH_DIAGRAMS.forewing;
  const progress = Math.round((_identifyStep / CHARACTERS.length) * 100);
  const answered = Object.values(_identifyAnswers).filter(Boolean).length;

  container.innerHTML = `
    <div class="identify-top">
      <div class="identify-progress-bar"><div style="width:${progress}%"></div></div>
      <div class="identify-step-label">Step ${_identifyStep + 1} of ${CHARACTERS.length} · ${answered} answered</div>
    </div>
    ${diagram}
    <div class="identify-question">${char.label}</div>
    ${char.hint ? `<div class="identify-hint">${char.hint}</div>` : ''}
    <div class="identify-options">
      ${char.options.map(opt => `
        <button class="identify-opt ${_identifyAnswers[char.id] === opt.value ? 'selected' : ''}"
          onclick="window.__mothApp.identifyAnswer('${char.id}','${opt.value}')">
          <strong>${opt.label}</strong>${opt.desc ? `<span>${opt.desc}</span>` : ''}
        </button>`).join('')}
    </div>
    <div class="identify-nav">
      <button class="identify-skip" onclick="window.__mothApp.identifySkip()">Skip</button>
      <button class="identify-results-btn" onclick="window.__mothApp.identifyAnswer('${char.id}',window.__mothApp._state._identifyAnswers?.['${char.id}'] || null, true)">See results →</button>
    </div>`;
}

function identifyAnswer(charId, value, goToResults) {
  _identifyAnswers[charId] = value;
  if (goToResults || _identifyStep >= CHARACTERS.length - 1) {
    renderIdentifyResults();
  } else {
    _identifyStep++;
    renderIdentifyStep();
  }
}

function identifySkip() {
  _identifyAnswers[CHARACTERS[_identifyStep]?.id] = null;
  if (_identifyStep >= CHARACTERS.length - 1) renderIdentifyResults();
  else { _identifyStep++; renderIdentifyStep(); }
}

function identifyReset() {
  _identifyAnswers = {};
  _identifyStep = 0;
  renderIdentifyStep();
}

function renderIdentifyResults() {
  const container = document.getElementById('identify-content');
  if (!container) return;
  const results = runKey(_identifyAnswers, state.allMoths);
  container.innerHTML = `
    <div class="identify-results-header">
      <div class="identify-results-title">Most likely matches</div>
      <button class="identify-reset-btn" onclick="window.__mothApp.identifyReset()">↩ Start over</button>
    </div>
    ${results.length === 0
      ? `<div class="empty">No matches — try skipping some characters.</div>`
      : results.map(r => `
        <div class="identify-result-card" onclick="window.open('https://www.inaturalist.org/taxa/${r.inatId}','_blank','noopener')">
          <div class="identify-result-score ${r.matchScore >= 75 ? 'score-good' : r.matchScore >= 50 ? 'score-fair' : 'score-poor'}">${r.matchScore}%</div>
          <div class="identify-result-info">
            <div class="identify-result-name">${r.name}${r.inForecast ? ' <span class="identify-tonight-badge">Tonight</span>' : ''}</div>
            <div class="identify-result-sci">${r.sci}</div>
            <div class="identify-result-note">${r.notes}</div>
          </div>
        </div>`).join('')}
    <div class="identify-disclaimer">Results narrow from ${state.allMoths.length ? 'tonight\'s ' + state.allMoths.length + ' forecasted species, then' : ''} Wyoming/Colorado database. Always verify with iNaturalist.</div>`;
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
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('eco-sel').addEventListener('change', function() {
  if (this.value === 'current') {
    this.classList.remove('neighbor-active');
    if (state.ecoregion) onNeighborClick(state.ecoregion.code, state.ecoregion.feature);
  } else {
    const n = _neighbors[parseInt(this.value.replace('n',''),10)];
    if (n) { this.classList.add('neighbor-active'); onNeighborClick(n.code, n.feature); }
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
    fetchAllSpeciesWithCache(state.currentLat, state.currentLng, { bbox: eco.bbox }),
    fetchNeighboringEcoregions(eco.bbox, eco.code),
  ]);
  updateEcoSelect(eco, neighbors);
  document.getElementById('conditions-section').style.display = 'block';
  if (!mothData?.length) {
    setStatus(`No moth records in ${eco.name} for this time of year.`);
    document.getElementById('results').innerHTML = `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.moon}</span>No records found.</div>`;
    return;
  }
  state.allMoths = mothData;
  setStatus('');
  renderMoths();
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

// ─── Caching wrappers ─────────────────────────────────────────
async function fetchAllSpeciesWithCache(lat, lng, queryOpts) {
  const cacheKey = queryOpts.bbox
    ? `eco_${Math.round(queryOpts.bbox.swlat*10)}_${Math.round(queryOpts.bbox.swlng*10)}`
    : `rad_${Math.round(lat*10)}_${Math.round(lng*10)}`;
  const cached = getCache('species', cacheKey);
  if (cached) {
    const ageMin = Math.round((getCacheAge('species', cacheKey) || 0) / 60000);
    showCacheAge(ageMin);
    return cached;
  }
  const data = await fetchAllSpecies(lat, lng, queryOpts);
  if (data?.length) setCache('species', cacheKey, data);
  return data;
}

function showCacheAge(ageMin) {
  const el = document.getElementById('cache-age-note');
  if (!el) return;
  if (ageMin < 1) return;
  el.textContent = `Species data ${ageMin < 60 ? ageMin+'m' : Math.round(ageMin/60)+'h'} old`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── Main fetch ───────────────────────────────────────────────
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
  document.getElementById('cache-age-note').style.display = 'none';

  const [forecastData, ecoData] = await Promise.all([
    fetchForecast(lat, lng),
    fetchEcoregionAtPoint(lat, lng),
  ]);

  state.ecoregion = ecoData;
  const hours = forecastData?.hours || null;
  state.forecastDaily = forecastData?.daily || [];

  if (_sheetMapInited && ecoData) {
    placeMarker(lat, lng, false);
    setEcoregionLayers(ecoData.feature, [], () => {});
  }

  const queryOpts = ecoData ? { bbox: ecoData.bbox } : { radiusKm: FALLBACK_RADIUS_KM };

  const [mothData, habitatData, neighbors] = await Promise.all([
    fetchAllSpeciesWithCache(lat, lng, queryOpts),
    fetchHabitat(lat, lng, ecoData ? 50 : FALLBACK_RADIUS_KM),
    ecoData ? fetchNeighboringEcoregions(ecoData.bbox, ecoData.code) : Promise.resolve([]),
  ]);

  state.habitat = habitatData;
  updateEcoSelect(ecoData, neighbors);

  if (hours?.length) {
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
  updateMyListBadge();
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
document.getElementById('header-moon-icon').addEventListener('click', toggleMoonPanel);
document.getElementById('header-moon-icon').style.cursor = 'pointer';
document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(getMoonPhase().fraction);
document.getElementById('icon-chevleft').innerHTML = ICONS.chevronLeft;
document.getElementById('icon-chevright').innerHTML = ICONS.chevronRight;
document.getElementById('icon-star-badge').innerHTML = ICONS.star;

// Drawer icons
const HEART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const GEAR_SVG  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
document.getElementById('di-icon-forecast').innerHTML = ICONS.moon;
document.getElementById('di-icon-identify').innerHTML = ICONS.camera;
document.getElementById('di-icon-mylist').innerHTML = HEART_SVG;
document.getElementById('di-icon-settings').innerHTML = GEAR_SVG;

document.getElementById('loc-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchByText(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); toggleLocationSheet(false); if (_drawerOpen) toggleDrawer(); if (_moonPanelOpen) toggleMoonPanel(); }
});
document.querySelectorAll('#sort-sel,#freq-sel,#habitat-sel').forEach(el => el.addEventListener('change', () => renderMoths()));

initTheme();
updateMyListBadge();

const saved = loadSavedLocation();
if (saved) { setLocationLabel(saved.name); document.getElementById('loc-input').value = saved.name; fetchAll(saved.lat, saved.lng, saved.name); }
else geoLocate();

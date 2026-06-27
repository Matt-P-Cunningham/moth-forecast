import { state } from '../state.js';
import { geocodeText } from '../geo.js';
import { escapeHTML } from '../utils.js';

const EPA_L3 = 'https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/11';
const EPA_L4 = 'https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/7';
const MILES_TO_KM = 1.60934;
const DEG_PER_MILE = 1 / 69.0;

// Map state
let _map = null;
let _inited = false;
let _radiusMiles = 300;
let _centerLat = 39.5;
let _centerLng = -105.5;
let _radiusCircle = null;
let _l3Group = null;
let _l4Group = null;
let _drillMode = false;
let _sheetRegion = null;
const _l3Cache = new Map();
const _l4Cache = new Map();

// Layer styles (hardcoded for Leaflet — CSS vars not available in JS context)
const S_CURRENT  = { color: 'rgba(84,166,104,0.8)', weight: 2,   fillColor: '#4a7c59', fillOpacity: 0.4  };
const S_NEIGHBOR = { color: 'rgba(84,166,104,0.8)', weight: 2,   fillColor: '#3a5a48', fillOpacity: 0.25 };
const S_OUTSIDE  = { color: 'rgba(40,40,40,0.8)',   weight: 0.5, fillColor: '#111',    fillOpacity: 0.35 };
const S_L4_BASE  = { color: 'rgba(84,166,104,0.8)', weight: 2,   fillColor: '#3a6a50', fillOpacity: 0.25 };
const S_L4_HOVER = { color: '#54a668',               weight: 2.5, fillColor: '#4a7c59', fillOpacity: 0.42 };

const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// ── Public API ──────────────────────────────────────────────────

export function onExploreActivated() {
  const lat = state.currentLat ? parseFloat(state.currentLat) : null;
  const lng = state.currentLng ? parseFloat(state.currentLng) : null;
  if (lat && lng) { _centerLat = lat; _centerLng = lng; }

  if (!_inited) {
    _inited = true;
    _initMap();
  } else if (_map) {
    setTimeout(() => _map.invalidateSize(), 100);
    // Re-sync current ecoregion shading if species loaded since last visit
    if (!_drillMode && _l3Group) _loadL3Regions();
  }
}

export function setExploreRadius(btn) {
  document.querySelectorAll('.radius-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _radiusMiles = parseInt(btn.dataset.miles, 10);
  _drawRadiusCircle();
  if (!_drillMode) _loadL3Regions();
}

export async function searchExplore() {
  if (!navigator.onLine) return;
  const input = document.getElementById('explore-search');
  const q = (input?.value || '').trim();
  if (!q) return;
  try {
    const r = await geocodeText(q);
    if (!r) { _toast('Location not found'); return; }
    _centerLat = parseFloat(r.lat);
    _centerLng = parseFloat(r.lng);
    if (_map) {
      _map.setView([_centerLat, _centerLng], Math.max(_map.getZoom(), 5));
      _drawRadiusCircle();
      if (!_drillMode) _loadL3Regions();
    }
  } catch { _toast('Search unavailable'); }
}

export function closeExploreSheet() {
  document.getElementById('explore-region-sheet').style.display = 'none';
  document.getElementById('explore-sheet-backdrop').style.display = 'none';
  _sheetRegion = null;
}

export function filterForecastToRegion() {
  if (!_sheetRegion) return;
  const region = _sheetRegion;
  closeExploreSheet();
  // Build eco object compatible with jumpToEcoregion in app.js
  const ecoObj = {
    code: region.l3code || region.name,
    name: region.name,
    l3name: region.name,
    l2name: region.l2name || '',
    l1name: region.l1name || '',
    bbox: _bboxFromFeature(region.feature),
    feature: region.feature,
  };
  window.__mothApp.jumpToEcoregion(ecoObj);
}

export async function drillDeeper() {
  if (!_sheetRegion || _sheetRegion.isL4) return;
  const region = _sheetRegion;
  closeExploreSheet();

  const cacheKey = region.l3code || region.name;
  let features = _l4Cache.get(cacheKey);
  if (!features) {
    const bbox = _bboxFromFeature(region.feature);
    features = await _fetchEpaFeatures(EPA_L4, bbox,
      'US_L4CODE,US_L4NAME,US_L3CODE,US_L3NAME,NA_L2NAME,NA_L1NAME', '0.003');
    if (features?.length) _l4Cache.set(cacheKey, features);
  }

  if (!features?.length) {
    _toast('Level IV detail not available for this region');
    return;
  }

  _drillMode = true;
  document.getElementById('explore-back-btn').style.display = 'block';

  // Zoom to L3 bounds
  try { _map.fitBounds(L.geoJSON(region.feature).getBounds(), { padding: [24, 24] }); } catch {}

  // Swap layers
  if (_l3Group) _map.removeLayer(_l3Group);
  if (!_l4Group) _l4Group = L.layerGroup();
  _l4Group.clearLayers();

  for (const feat of features) {
    const props = feat.properties;
    const layer = L.geoJSON(feat, { style: S_L4_BASE, smoothFactor: 1.5 });
    layer.on('mouseover', () => layer.setStyle(S_L4_HOVER));
    layer.on('mouseout',  () => layer.setStyle(S_L4_BASE));
    layer.on('click', e => {
      L.DomEvent.stopPropagation(e);
      _openSheet({
        l3code: props.US_L3CODE || '',
        l4code: props.US_L4CODE || '',
        name: props.US_L4NAME || props.US_L3NAME || 'Subregion',
        l2name: props.NA_L2NAME || '',
        l1name: props.NA_L1NAME || '',
        feature: feat,
        isL4: true,
        speciesCount: state.ecoregion?.code === props.US_L4CODE ? (state.allMoths?.length ?? null) : null,
      });
    });
    layer.addTo(_l4Group);
  }
  _l4Group.addTo(_map);
}

export function drillBack() {
  if (!_drillMode) return;
  _drillMode = false;
  document.getElementById('explore-back-btn').style.display = 'none';
  if (_l4Group) _map.removeLayer(_l4Group);
  if (_l3Group) _l3Group.addTo(_map);
  try { if (_radiusCircle) _map.fitBounds(_radiusCircle.getBounds(), { padding: [20, 20] }); } catch {}
}

// ── Map init ────────────────────────────────────────────────────

function _initMap() {
  if (typeof L === 'undefined') return;
  const el = document.getElementById('explore-map');
  if (!el) return;

  _map = L.map('explore-map', { zoomControl: true, attributionControl: true })
           .setView([_centerLat, _centerLng], 6);

  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri', maxZoom: 19 }
  ).addTo(_map);

  _l3Group = L.layerGroup().addTo(_map);
  _drawRadiusCircle();
  _loadL3Regions();

  // Tap on map dismisses the sheet
  _map.on('click', () => closeExploreSheet());

  // Search bar key handler + offline state
  document.getElementById('explore-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchExplore();
  });

  // Sheet swipe-down dismiss — register once
  _initSheetSwipe();

  _syncOffline();
  window.addEventListener('online',  _syncOffline);
  window.addEventListener('offline', _syncOffline);
}

// ── Offline sync ────────────────────────────────────────────────

function _syncOffline() {
  const online = navigator.onLine;
  const overlay = document.getElementById('explore-offline-overlay');
  if (overlay) overlay.style.display = online ? 'none' : 'flex';
  const search = document.getElementById('explore-search');
  const btn = document.getElementById('explore-search-btn');
  if (search) { search.disabled = !online; search.placeholder = online ? 'Search location…' : 'Search unavailable offline'; }
  if (btn) btn.disabled = !online;
}

// ── Radius circle ───────────────────────────────────────────────

function _drawRadiusCircle() {
  if (!_map) return;
  if (_radiusCircle) { _radiusCircle.remove(); _radiusCircle = null; }
  _radiusCircle = L.circle([_centerLat, _centerLng], {
    radius: _radiusMiles * MILES_TO_KM * 1000,
    color: 'rgba(84,166,104,0.7)',
    weight: 2,
    dashArray: '6,9',
    fill: false,
    interactive: false,
  }).addTo(_map);
}

// ── L3 region rendering ─────────────────────────────────────────

async function _loadL3Regions() {
  if (!_map) return;
  // Bounding box with generous padding (longitude stretched for aspect ratio)
  const halfLat = _radiusMiles * DEG_PER_MILE * 1.25;
  const halfLng = halfLat * 1.4;
  const bbox = {
    swlat: _centerLat - halfLat, swlng: _centerLng - halfLng,
    nelat: _centerLat + halfLat, nelng: _centerLng + halfLng,
  };

  const cacheKey = `${Math.round(_centerLat * 4)}_${Math.round(_centerLng * 4)}_${_radiusMiles}`;
  let features = _l3Cache.get(cacheKey);
  if (!features) {
    features = await _fetchEpaFeatures(EPA_L3, bbox, 'US_L3CODE,US_L3NAME,NA_L2NAME,NA_L1NAME', '0.01');
    if (features?.length) _l3Cache.set(cacheKey, features);
  }
  if (!features?.length) return;

  _l3Group.clearLayers();
  const radiusKm = _radiusMiles * MILES_TO_KM;
  const currentL3 = state.ecoregion?.l3name || '';

  for (const feat of features) {
    const props = feat.properties;
    const l3name = props.US_L3NAME || '';
    const isCurrentL3 = !!currentL3 && currentL3 === l3name;
    const centroid = _centroid(feat);
    const distKm = centroid ? _haversine(_centerLat, _centerLng, centroid[1], centroid[0]) : 0;
    const inRadius = distKm < radiusKm * 1.15;

    const style = isCurrentL3 ? S_CURRENT : inRadius ? S_NEIGHBOR : S_OUTSIDE;
    const layer = L.geoJSON(feat, { style, smoothFactor: 1.8 });

    if (!inRadius && !isCurrentL3) {
      layer.on('mouseover', () => layer.setStyle(S_NEIGHBOR));
      layer.on('mouseout',  () => layer.setStyle(S_OUTSIDE));
    }

    layer.on('click', e => {
      L.DomEvent.stopPropagation(e);
      _openSheet({
        l3code: props.US_L3CODE || '',
        name: l3name || 'Unknown Region',
        l2name: props.NA_L2NAME || '',
        l1name: props.NA_L1NAME || '',
        feature: feat,
        isL4: false,
        speciesCount: currentL3 === l3name ? (state.allMoths?.length ?? null) : null,
      });
    });

    layer.addTo(_l3Group);
  }
}

// ── Region bottom sheet ─────────────────────────────────────────

function _openSheet(region) {
  _sheetRegion = region;
  const codeStr = region.isL4 ? (region.l4code || '') : (region.l3code || '');
  const speciesStr = region.speciesCount != null
    ? `${region.speciesCount} species recorded nearby`
    : '— species';

  document.getElementById('explore-sheet-content').innerHTML = `
    <div class="explore-sheet-head">
      <div class="explore-sheet-name-block">
        <div class="explore-sheet-name">${escapeHTML(region.name)}</div>
        ${codeStr ? `<div class="explore-sheet-code">${escapeHTML(codeStr)}</div>` : ''}
        ${region.l2name ? `<div class="explore-sheet-desc">${escapeHTML(region.l2name)}</div>` : ''}
      </div>
      <button class="sheet-close" onclick="window.__mothApp.closeExploreSheet()">${X_ICON}</button>
    </div>
    <div class="explore-sheet-species">${escapeHTML(speciesStr)}</div>
    <div class="explore-sheet-actions">
      <button class="btn btn-primary" onclick="window.__mothApp.filterForecastToRegion()">
        Filter Forecast to this region
      </button>
      ${!region.isL4 ? `<button class="btn" onclick="window.__mothApp.drillDeeper()">Drill Deeper</button>` : ''}
    </div>
  `;

  document.getElementById('explore-region-sheet').style.display = 'block';
  document.getElementById('explore-sheet-backdrop').style.display = 'block';
}

function _initSheetSwipe() {
  const sheet = document.getElementById('explore-region-sheet');
  let startY = 0, delta = 0;
  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY; delta = 0; sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0) { delta = d; sheet.style.transform = `translateY(${d}px)`; }
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (delta > 80) {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = 'translateY(110%)';
      setTimeout(() => { sheet.style.transform = ''; closeExploreSheet(); }, 200);
    } else {
      sheet.style.transition = 'transform 0.2s ease';
      sheet.style.transform = '';
    }
  });
}

// ── EPA ArcGIS fetch ────────────────────────────────────────────

async function _fetchEpaFeatures(layer, bbox, outFields, maxOffset) {
  try {
    const params = new URLSearchParams({
      geometry: JSON.stringify({ xmin: bbox.swlng, ymin: bbox.swlat, xmax: bbox.nelng, ymax: bbox.nelat }),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields,
      returnGeometry: 'true',
      outSR: '4326',
      maxAllowableOffset: maxOffset,
      f: 'geojson',
    });
    const res = await fetch(`${layer}/query?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.features || [];
  } catch { return null; }
}

// ── Geometry helpers ────────────────────────────────────────────

function _bboxFromFeature(feat) {
  const pts = [];
  const walk = c => typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk);
  walk(feat.geometry.coordinates);
  return {
    swlat: Math.min(...pts.map(p => p[1])),
    swlng: Math.min(...pts.map(p => p[0])),
    nelat: Math.max(...pts.map(p => p[1])),
    nelng: Math.max(...pts.map(p => p[0])),
  };
}

function _centroid(feat) {
  const pts = [];
  const walk = c => typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk);
  walk(feat.geometry.coordinates);
  if (!pts.length) return null;
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function _haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _toast(msg) {
  window.__mothApp?.showToast?.(msg);
}

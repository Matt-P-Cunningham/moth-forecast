import { state } from './state.js';
import { ICONS } from './icons.js';

const STYLE_CURRENT = {
  color: '#3d6b2e', weight: 2, fillColor: '#4a7c59', fillOpacity: 0.15,
};
const STYLE_NEIGHBOR_HIDDEN = {
  color: 'transparent', weight: 0, fillColor: '#000', fillOpacity: 0.001,
};
const STYLE_NEIGHBOR_HOVER = {
  color: '#7aab8a', weight: 1.5, fillColor: '#4a7c59', fillOpacity: 0.08,
};

let _onPickCallback = null;
let _ecoLayerGroup = null;
let _mapExpanded = false;

export function initMap(lat, lng, onPick) {
  _onPickCallback = onPick;

  const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lng], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: 'map-pin-icon',
    html: ICONS.pinFilled,
    iconSize: [30, 30],
    iconAnchor: [15, 29]
  });

  const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);

  marker.on('dragend', e => {
    const ll = e.target.getLatLng();
    _onPickCallback(ll.lat, ll.lng);
  });

  map.on('click', e => {
    marker.setLatLng(e.latlng);
    _onPickCallback(e.latlng.lat, e.latlng.lng);
  });

  _ecoLayerGroup = L.layerGroup().addTo(map);

  state._map = map;
  state._marker = marker;
}

export function toggleMapExpand() {
  _mapExpanded = !_mapExpanded;
  const wrap = document.querySelector('.map-wrap');
  const btn = document.getElementById('map-expand-btn');
  const iconEl = document.getElementById('icon-mapexpand');
  wrap.classList.toggle('map-expanded', _mapExpanded);
  if (iconEl) iconEl.innerHTML = _mapExpanded ? ICONS.compress : ICONS.expand;
  if (btn) btn.title = _mapExpanded ? 'Collapse map' : 'Expand map';
  if (state._map) {
    // Wait for CSS transition to finish before invalidating size
    setTimeout(() => state._map.invalidateSize(), 310);
  }
}

export function placeMarker(lat, lng, pan) {
  if (!state._map) return;
  state._marker.setLatLng([lat, lng]);
  if (pan) state._map.setView([lat, lng], Math.max(state._map.getZoom(), 6));
}

export function setMapZoom(zoom) {
  if (state._map) state._map.setZoom(zoom);
}

export function setEcoregionLayers(currentFeature, neighborFeatures, onNeighborClick) {
  if (!_ecoLayerGroup) return;
  _ecoLayerGroup.clearLayers();

  // Neighbors: invisible until hover
  for (const feat of neighborFeatures) {
    const name = feat.properties.US_L4NAME || feat.properties.US_L3NAME || '';
    const layer = L.geoJSON(feat, { style: STYLE_NEIGHBOR_HIDDEN, smoothFactor: 1.5 });
    layer.on('mouseover', () => layer.setStyle(STYLE_NEIGHBOR_HOVER));
    layer.on('mouseout',  () => layer.setStyle(STYLE_NEIGHBOR_HIDDEN));
    layer.on('click', e => {
      L.DomEvent.stopPropagation(e);
      onNeighborClick(feat.properties.US_L4CODE, feat);
    });
    if (name) layer.bindTooltip(name, { sticky: true, className: 'eco-tip' });
    layer.addTo(_ecoLayerGroup);
  }

  // Current ecoregion: clean filled polygon on top
  const name = currentFeature.properties.US_L4NAME || currentFeature.properties.US_L3NAME || '';
  const current = L.geoJSON(currentFeature, { style: STYLE_CURRENT, smoothFactor: 1.5 });
  if (name) current.bindTooltip(name, { sticky: true, className: 'eco-tip eco-tip-current' });
  current.addTo(_ecoLayerGroup);

  try {
    const bounds = L.geoJSON(currentFeature).getBounds();
    state._map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  } catch(e) {}
}

export function clearEcoregionLayers() {
  if (_ecoLayerGroup) _ecoLayerGroup.clearLayers();
}

import { state } from './state.js';
import { ICONS } from './icons.js';

const STYLE_CURRENT   = { color: '#3d6b2e', weight: 2.5, fillColor: '#3d6b2e', fillOpacity: 0.15, dashArray: null };
const STYLE_NEIGHBOR  = { color: '#6b6960', weight: 1,   fillColor: '#6b6960', fillOpacity: 0.06, dashArray: '4 3' };
const STYLE_HOVER     = { fillOpacity: 0.18, color: '#3d6b2e', weight: 2 };

let _onPickCallback = null;
let _ecoLayerGroup = null;

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
    // Only respond to direct map clicks, not clicks on ecoregion polygons
    marker.setLatLng(e.latlng);
    _onPickCallback(e.latlng.lat, e.latlng.lng);
  });

  _ecoLayerGroup = L.layerGroup().addTo(map);

  state._map = map;
  state._marker = marker;
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

  // Draw neighbors first (below current)
  for (const feat of neighborFeatures) {
    const layer = L.geoJSON(feat, { style: STYLE_NEIGHBOR });
    layer.on('mouseover', () => layer.setStyle(STYLE_HOVER));
    layer.on('mouseout',  () => layer.setStyle(STYLE_NEIGHBOR));
    layer.on('click', e => {
      L.DomEvent.stopPropagation(e);
      onNeighborClick(feat.properties.US_L3CODE, feat);
    });
    layer.bindTooltip(feat.properties.US_L3NAME, { sticky: true, className: 'eco-tooltip' });
    layer.addTo(_ecoLayerGroup);
  }

  // Draw current ecoregion on top
  const current = L.geoJSON(currentFeature, { style: STYLE_CURRENT });
  current.bindTooltip(currentFeature.properties.US_L3NAME, { sticky: true, className: 'eco-tooltip eco-tooltip-current' });
  current.addTo(_ecoLayerGroup);

  // Fit map to current ecoregion bounds with some padding
  try {
    const bounds = L.geoJSON(currentFeature).getBounds();
    state._map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  } catch(e) {}
}

export function clearEcoregionLayers() {
  if (_ecoLayerGroup) _ecoLayerGroup.clearLayers();
}

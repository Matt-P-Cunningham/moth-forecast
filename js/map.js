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

let _map = null;
let _marker = null;
let _onPickCallback = null;
let _ecoLayerGroup = null;

export function initMap(lat, lng, onPick, containerId = 'location-map') {
  // Don't init if Leaflet isn't loaded or container doesn't exist
  if (typeof L === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  _onPickCallback = onPick;

  _map = L.map(containerId, { zoomControl: true, attributionControl: true }).setView([lat, lng], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(_map);

  const pinIcon = L.divIcon({
    className: 'map-pin-icon',
    html: ICONS.pinFilled,
    iconSize: [30, 30],
    iconAnchor: [15, 29]
  });

  _marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(_map);

  _marker.on('dragend', e => {
    const ll = e.target.getLatLng();
    if (_onPickCallback) _onPickCallback(ll.lat, ll.lng);
  });

  _map.on('click', e => {
    _marker.setLatLng(e.latlng);
    if (_onPickCallback) _onPickCallback(e.latlng.lat, e.latlng.lng);
  });

  _ecoLayerGroup = L.layerGroup().addTo(_map);
}

export function invalidateMapSize() {
  if (_map) _map.invalidateSize();
}

export function placeMarker(lat, lng, pan) {
  if (!_map || !_marker) return;
  _marker.setLatLng([lat, lng]);
  if (pan) _map.setView([lat, lng], Math.max(_map.getZoom(), 6));
}

export function setMapZoom(zoom) {
  if (_map) _map.setZoom(zoom);
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
    _map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  } catch(e) {}
}

export function clearEcoregionLayers() {
  if (_ecoLayerGroup) _ecoLayerGroup.clearLayers();
}

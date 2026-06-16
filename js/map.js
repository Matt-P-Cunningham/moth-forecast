import { state } from './state.js';
import { saveRadius } from './storage.js';
import { ICONS } from './icons.js';

let onPickCallback = null;

export function initMap(lat, lng, onPick) {
  onPickCallback = onPick;
  const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lng], 8);
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
  const circle = L.circle([lat, lng], {
    radius: state.radiusKm * 1000,
    color: '#3d6b2e', weight: 1, fillColor: '#3d6b2e', fillOpacity: 0.08
  }).addTo(map);

  marker.on('dragend', e => {
    const ll = e.target.getLatLng();
    circle.setLatLng(ll);
    onPickCallback(ll.lat, ll.lng);
  });

  map.on('click', e => {
    marker.setLatLng(e.latlng);
    circle.setLatLng(e.latlng);
    onPickCallback(e.latlng.lat, e.latlng.lng);
  });

  state._map = map;
  state._marker = marker;
  state._circle = circle;
}

export function placeMarker(lat, lng, pan) {
  if (!state._map) return;
  state._marker.setLatLng([lat, lng]);
  state._circle.setLatLng([lat, lng]);
  if (pan) state._map.setView([lat, lng], Math.max(state._map.getZoom(), 8));
}

export function setMapZoom(zoom) {
  if (state._map) state._map.setZoom(zoom);
}

export function onRadiusInput(val) {
  state.radiusKm = parseInt(val, 10);
  document.getElementById('radius-value').textContent = state.radiusKm + ' km';
  if (state._circle) state._circle.setRadius(state.radiusKm * 1000);
}

export function onRadiusChange(val, reloadFn) {
  state.radiusKm = parseInt(val, 10);
  saveRadius(state.radiusKm);
  if (state._circle) state._circle.setRadius(state.radiusKm * 1000);
  if (state.currentLat != null) reloadFn();
}

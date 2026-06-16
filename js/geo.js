import { NOMINATIM_API } from './config.js';

export async function geocodeText(query) {
  const res = await fetch(`${NOMINATIM_API}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
  const data = await res.json();
  if (!data.length) return null;
  const { lat, lon, display_name } = data[0];
  const parts = display_name.split(',').map(p => p.trim()).filter(Boolean);
  const name = parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : display_name;
  return { lat: parseFloat(lat).toFixed(5), lng: parseFloat(lon).toFixed(5), name };
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${NOMINATIM_API}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
    const d = await res.json();
    const a = d.address || {};
    const locality = a.city || a.town || a.village || a.hamlet || a.county || a.state;
    return locality && a.country ? `${locality}, ${a.country}` : (d.display_name || `${(+lat).toFixed(3)}, ${(+lng).toFixed(3)}`);
  } catch(e) {
    return `${(+lat).toFixed(3)}, ${(+lng).toFixed(3)}`;
  }
}

export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('not-supported')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
      () => reject(new Error('denied')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

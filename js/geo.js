import { NOMINATIM_API } from './config.js';

function formatLocation(a, fallback) {
  const locality = a.city || a.town || a.village || a.hamlet || a.county;
  // US → "Town, State";  everywhere else → "Town, Country";  never "United States"
  const region = a.country_code === 'us' ? a.state : a.country;
  if (locality && region) return `${locality}, ${region}`;
  if (locality && a.state)   return `${locality}, ${a.state}`;
  if (locality)              return locality;
  if (region)                return region;
  return fallback;
}

export async function geocodeText(query) {
  const res = await fetch(`${NOMINATIM_API}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
  const data = await res.json();
  if (!data.length) return null;
  const { lat, lon, address, display_name } = data[0];
  const name = formatLocation(address || {}, display_name.split(',')[0].trim());
  return { lat: parseFloat(lat).toFixed(5), lng: parseFloat(lon).toFixed(5), name };
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${NOMINATIM_API}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
    const d = await res.json();
    return formatLocation(d.address || {}, d.display_name || `${(+lat).toFixed(3)}, ${(+lng).toFixed(3)}`);
  } catch {
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

import { OPEN_METEO_API, FORECAST_DAYS } from './config.js';
import { getMoonPhase } from './moon.js';
import { calcNightScore } from './scoring.js';

// Hourly forecast — returns array of hour objects (original contract unchanged)
export async function fetchForecast(lat, lng) {
  try {
    const url = `${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,wind_speed_10m,cloud_cover,precipitation,is_day` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return buildForecast(data.hourly);
  } catch(e) { return null; }
}

// Separate non-blocking fetch for daily moon data (moonrise/moonset)
// Returns array of daily objects or [] — never throws
export async function fetchMoonData(lat, lng) {
  try {
    const url = `${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}` +
      `&daily=moonrise,moonset,sunrise,sunset` +
      `&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return buildDaily(data.daily);
  } catch(e) { return []; }
}

function buildForecast(hourly) {
  if (!hourly || !hourly.time) return [];
  const moonCache = {};
  const out = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const iso = hourly.time[i];
    const [datePart, timePart] = iso.split('T');
    const [y, mo, d] = datePart.split('-').map(Number);
    const hour = parseInt(timePart.slice(0, 2), 10);
    if (!moonCache[datePart]) moonCache[datePart] = getMoonPhase(new Date(y, mo - 1, d, 12));
    const w = {
      temp: Math.round(hourly.temperature_2m[i]),
      wind: Math.round(hourly.wind_speed_10m[i]),
      clouds: Math.round(hourly.cloud_cover[i]),
      precip: Number(hourly.precipitation[i] || 0),
      isDay: hourly.is_day[i] === 1,
    };
    const nr = calcNightScore(w, moonCache[datePart]);
    out.push({ iso, y, mo, d, hour, ...w, moon: moonCache[datePart], ...nr });
  }
  return out;
}

function buildDaily(daily) {
  if (!daily || !daily.time) return [];
  return daily.time.map((date, i) => {
    const [y, mo, d] = date.split('-').map(Number);
    const moon = getMoonPhase(new Date(y, mo - 1, d, 20));
    return {
      date, y, mo, d,
      moonrise: daily.moonrise?.[i] || null,
      moonset:  daily.moonset?.[i]  || null,
      sunrise:  daily.sunrise?.[i]  || null,
      sunset:   daily.sunset?.[i]   || null,
      moon,
    };
  });
}

export function findNowIndex(hours) {
  const now = new Date();
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < hours.length; i++) {
    const diff = Math.abs(new Date(hours[i].y, hours[i].mo - 1, hours[i].d, hours[i].hour) - now);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

export function findPeakIndex(hours, fromIndex) {
  let best = fromIndex;
  for (let i = fromIndex; i < hours.length; i++) {
    if (hours[i].score > hours[best].score) best = i;
  }
  return best;
}

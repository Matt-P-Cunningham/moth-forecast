const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const CYCLE = 29.53059;

// ─── Client-side moonrise/moonset (Jean Meeus simplified) ─────
// Accurate to ~2-3 minutes for display purposes.
const _D = Math.PI / 180; // degrees → radians
const _H0 = -0.5 * _D;   // standard altitude at moonrise/set (horizon correction)

function _toDays(ms) {
  // Julian days from J2000.0
  return ms / 86400000 - 10957.5;
}

function _moonEq(d) {
  // Simplified moon ecliptic position (Meeus Ch.47 main terms)
  const L = 218.316 + 13.176396 * d;           // mean longitude °
  const M = (134.963 + 13.064993 * d) * _D;    // anomaly rad
  const F = (93.272  + 13.229350 * d) * _D;    // arg of latitude rad
  const lon = (L + 6.289 * Math.sin(M)) * _D;  // ecliptic lon rad
  const lat = 5.128 * Math.sin(F) * _D;        // ecliptic lat rad
  const eps = 23.4397 * _D;                    // obliquity rad (constant approx)
  return {
    ra:  Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)),
    dec: Math.asin( Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon)),
  };
}

function _moonAlt(ms, phi, lngDeg) {
  const d = _toDays(ms);
  const { ra, dec } = _moonEq(d);
  // GMST → LST → local hour angle
  const gmst = (280.46061837 + 360.98564736629 * d) * _D;
  const H = gmst + lngDeg * _D - ra;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

// Returns { rise: Date|null, set: Date|null } for the given UTC date and GPS position.
// Scans 30 hours from midnight UTC of (year, month, day) in 1-hour steps.
export function calcMoonRiseSet(year, month, day, latDeg, lngDeg) {
  const phi = latDeg * _D;
  const startMs = Date.UTC(year, month - 1, day);
  const STEP = 3600000; // 1 hour
  let rise = null, set = null;
  let prev = _moonAlt(startMs, phi, lngDeg);

  for (let i = 1; i <= 30; i++) {
    const ms = startMs + i * STEP;
    const alt = _moonAlt(ms, phi, lngDeg);
    if (!rise && prev < _H0 && alt >= _H0) {
      rise = new Date(startMs + (i - 1 + (_H0 - prev) / (alt - prev)) * STEP);
    } else if (!set && prev >= _H0 && alt < _H0) {
      set  = new Date(startMs + (i - 1 + (prev - _H0) / (prev - alt)) * STEP);
    }
    prev = alt;
    if (rise && set) break;
  }
  return { rise, set };
}

export function getMoonPhase(date) {
  date = date || new Date();
  const diff = (date - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const phase = ((diff % CYCLE) + CYCLE) % CYCLE;
  const fraction = phase / CYCLE;
  const illum = Math.round((1 - Math.cos(2 * Math.PI * fraction)) / 2 * 100);
  let name;
  if (phase < 1.85) name = 'New Moon';
  else if (phase < 7.38) name = 'Waxing Crescent';
  else if (phase < 9.22) name = 'First Quarter';
  else if (phase < 14.77) name = 'Waxing Gibbous';
  else if (phase < 16.61) name = 'Full Moon';
  else if (phase < 22.15) name = 'Waning Gibbous';
  else if (phase < 23.99) name = 'Last Quarter';
  else name = 'Waning Crescent';
  return { phase, fraction, illum, name, darkScore: Math.round((1 - illum / 100) * 100) };
}

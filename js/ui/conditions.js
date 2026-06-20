import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
import { calcMoonRiseSet } from '../moon.js';
import { escapeHTML } from '../utils.js';

const HABITAT_ICONS = {
  forest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 22V12l-5-9-5 9v10"/><path d="M5 22h14"/><path d="M9 22v-6h6v6"/></svg>`,
  wetland: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M2 18h20M12 2c0 4-4 8-4 8h8s-4-4-4-8z"/></svg>`,
  grassland: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c1-3 3-5 5-4M7 18c1-4 4-7 7-6M12 18c1-5 5-9 9-8M2 18h20"/></svg>`,
  urban: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="7" height="15"/><rect x="9" y="3" width="7" height="19"/><rect x="16" y="10" width="6" height="12"/></svg>`,
  farmland: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-8 4 4 4-6 4 10"/><path d="M2 20h20"/></svg>`,
  shrubland: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4"/><circle cx="16" cy="14" r="4"/><circle cx="12" cy="10" r="4"/><path d="M2 20h20"/></svg>`,
  water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-4 6-6 10-6 13a6 6 0 0 0 12 0c0-3-2-7-6-13z"/></svg>`,
  coastal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M2 17c3-2 5-2 8 0s5 2 8 0"/><path d="M2 7c3-2 5-2 8 0s5 2 8 0"/></svg>`,
};

function fmtMoonTime(dt) {
  if (!dt) return '–';
  try {
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return '–'; }
}

export function renderConditions(h) {
  const grid = document.getElementById('conditions-grid');

  const tempQuality = h.temp >= 65 ? 'good' : h.temp >= 50 ? 'fair' : 'poor';
  const tempLabel = h.temp >= 65 ? 'Ideal' : h.temp >= 50 ? 'Acceptable' : 'Too cold';

  const windQuality = h.wind < 5 ? 'good' : h.wind < 15 ? 'fair' : 'poor';
  const windLabel = h.wind < 5 ? 'Calm' : h.wind < 10 ? 'Light breeze' : h.wind < 15 ? 'Moderate' : 'Too windy';

  const moonQuality = h.moon.darkScore >= 60 ? 'good' : h.moon.darkScore >= 30 ? 'fair' : 'poor';
  const moonLabel = h.moon.darkScore >= 75 ? 'Very dark' : h.moon.darkScore >= 50 ? 'Fairly dark' : h.moon.darkScore >= 25 ? 'Some light' : 'Bright night';

  const cloudPrecip = h.precip > 0
    ? { quality: 'poor', value: `${h.precip.toFixed(2)}"`, sub: 'Rain — moths shelter', label: 'Precip' }
    : h.clouds > 75
    ? { quality: 'fair', value: `${h.clouds}%`, sub: 'Overcast', label: 'Clouds' }
    : h.clouds > 30
    ? { quality: 'good', value: `${h.clouds}%`, sub: 'Partly cloudy', label: 'Clouds' }
    : { quality: 'good', value: h.clouds < 10 ? 'Clear' : `${h.clouds}%`, sub: 'Clear skies', label: 'Clouds' };

  // Client-side moonrise/moonset — no API needed (Jean Meeus algorithm)
  let moonTimes = '';
  if (state.currentLat != null && state.currentLng != null) {
    const { rise, set } = calcMoonRiseSet(h.y, h.mo, h.d, state.currentLat, state.currentLng);
    const rStr = rise ? `↑ ${fmtMoonTime(rise)}` : '';
    const sStr = set  ? `↓ ${fmtMoonTime(set)}`  : '';
    if (rStr || sStr) {
      const parts = [rStr, sStr].filter(Boolean).join(' · ');
      moonTimes = `<div class="cond-moon-times">${parts}</div>`;
    }
  }

  grid.innerHTML = `
    <div class="cond-tile ${moonQuality}">
      <div class="cond-icon moon-color">${moonPhaseSVG(h.moon.fraction)}</div>
      <div class="cond-value" style="font-size:15px;padding-top:2px">${escapeHTML(h.moon.name)}</div>
      <div class="cond-label">Moon · ${h.moon.illum}% lit</div>
      <div class="cond-sub">${moonLabel}</div>
      ${moonTimes}
    </div>
    <div class="cond-tile ${tempQuality}">
      <div class="cond-icon">${ICONS.thermometer}</div>
      <div class="cond-value">${h.temp}°F</div>
      <div class="cond-label">Temperature</div>
      <div class="cond-sub">${tempLabel}</div>
    </div>
    <div class="cond-tile ${windQuality}">
      <div class="cond-icon">${ICONS.wind}</div>
      <div class="cond-value">${h.wind} mph</div>
      <div class="cond-label">Wind</div>
      <div class="cond-sub">${windLabel}</div>
    </div>
    <div class="cond-tile ${cloudPrecip.quality}">
      <div class="cond-icon">${ICONS.rain}</div>
      <div class="cond-value">${escapeHTML(cloudPrecip.value)}</div>
      <div class="cond-label">${cloudPrecip.label}</div>
      <div class="cond-sub">${cloudPrecip.sub}</div>
    </div>
  `;

  const banner = document.getElementById('likelihood-banner');
  banner.className = 'likelihood-banner ' + (h.level === 'good' ? '' : h.level);
  document.getElementById('likelihood-label').textContent = h.label;
  document.getElementById('likelihood-desc').textContent = h.desc;
  document.getElementById('likelihood-score').innerHTML = h.score + '<span>/100</span>';

  document.getElementById('conditions-section').style.display = 'block';

  if (state.habitat) {
    document.getElementById('habitat-strip-container').innerHTML = habitatStrip(state.habitat);
  } else {
    document.getElementById('habitat-strip-container').innerHTML = '';
  }
}

function habitatStrip(habitat) {
  const icon = HABITAT_ICONS[habitat.primary] || ICONS.leaf;
  const topTypes = Object.entries(habitat.types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([, v]) => v > 0.05);
  const pills = topTypes.map(([k, v], i) =>
    `<span class="habitat-pill ${i > 0 ? 'secondary' : ''}">${escapeHTML(formatHabitat(k))} ${Math.round(v * 100)}%</span>`
  ).join('');
  return `<div class="habitat-strip">
    <div class="habitat-strip-icon">${icon}</div>
    <div>
      <div class="habitat-strip-label">${escapeHTML(habitat.label)}</div>
      <div class="habitat-pills">${pills}</div>
    </div>
  </div>`;
}

function formatHabitat(key) {
  return { forest:'Forest', wetland:'Wetland', grassland:'Grassland', urban:'Urban',
    farmland:'Farmland', shrubland:'Shrubland', water:'Water', coastal:'Coastal' }[key] || key;
}

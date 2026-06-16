import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
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

export function renderConditions(h) {
  const grid = document.getElementById('conditions-grid');

  const tempDots = [
    h.temp >= 50 ? 'on' : 'bad',
    h.temp >= 60 ? 'on' : (h.temp >= 50 ? 'warn' : 'bad'),
    h.temp >= 70 ? 'on' : (h.temp >= 60 ? 'warn' : 'bad'),
  ];
  const windDots = [
    h.wind < 15 ? 'on' : 'bad',
    h.wind < 10 ? 'on' : (h.wind < 15 ? 'warn' : 'bad'),
    h.wind < 5 ? 'on' : (h.wind < 10 ? 'warn' : 'bad'),
  ];
  const moonDots = [
    h.moon.darkScore >= 20 ? 'on' : 'warn',
    h.moon.darkScore >= 50 ? 'on' : (h.moon.darkScore >= 20 ? 'warn' : 'bad'),
    h.moon.darkScore >= 75 ? 'on' : (h.moon.darkScore >= 50 ? 'warn' : 'bad'),
  ];

  grid.innerHTML = `
    <div class="cond-card">
      <div class="cond-label"><span class="icon">${ICONS.thermometer}</span> Temperature</div>
      <div class="cond-value">${h.temp}°F</div>
      <div class="cond-sub">${h.temp >= 65 ? 'Ideal' : h.temp >= 50 ? 'Acceptable' : 'Too cold'}</div>
      <div class="cond-rating">${tempDots.map(d=>`<div class="dot ${d}"></div>`).join('')}</div>
    </div>
    <div class="cond-card">
      <div class="cond-label"><span class="icon">${ICONS.wind}</span> Wind</div>
      <div class="cond-value">${h.wind} mph</div>
      <div class="cond-sub">${h.wind < 5 ? 'Calm — ideal' : h.wind < 10 ? 'Light breeze' : h.wind < 15 ? 'Moderate' : 'Too windy'}</div>
      <div class="cond-rating">${windDots.map(d=>`<div class="dot ${d}"></div>`).join('')}</div>
    </div>
    <div class="cond-card">
      <div class="cond-label"><span class="icon">${moonPhaseSVG(h.moon.fraction)}</span> Moon</div>
      <div class="cond-value" style="font-size:16px;padding-top:4px">${escapeHTML(h.moon.name)}</div>
      <div class="cond-sub">${h.moon.illum}% lit · ${h.moon.darkScore >= 75 ? 'Very dark' : h.moon.darkScore >= 50 ? 'Fairly dark' : h.moon.darkScore >= 25 ? 'Some light' : 'Bright night'}</div>
      <div class="cond-rating">${moonDots.map(d=>`<div class="dot ${d}"></div>`).join('')}</div>
    </div>
    <div class="cond-card">
      <div class="cond-label"><span class="icon">${ICONS.rain}</span> Precipitation</div>
      <div class="cond-value">${h.precip > 0 ? h.precip.toFixed(2) + ' in' : 'None'}</div>
      <div class="cond-sub">${h.precip > 0 ? 'Moths will shelter' : 'Clear — good'}</div>
      <div class="cond-rating"><div class="dot ${h.precip === 0 ? 'on' : 'bad'}"></div><div class="dot ${h.precip === 0 ? 'on' : 'bad'}"></div><div class="dot ${h.precip === 0 ? 'on' : 'bad'}"></div></div>
    </div>
    ${state.habitat ? habitatCard(state.habitat) : ''}
  `;

  const banner = document.getElementById('likelihood-banner');
  banner.className = 'likelihood-banner ' + (h.level === 'good' ? '' : h.level);
  document.getElementById('likelihood-label').textContent = h.label;
  document.getElementById('likelihood-desc').textContent = h.desc;
  document.getElementById('likelihood-score').innerHTML = h.score + '<span>/100</span>';

  document.getElementById('conditions-section').style.display = 'block';
}

function habitatCard(habitat) {
  const icon = HABITAT_ICONS[habitat.primary] || ICONS.leaf;
  const topTypes = Object.entries(habitat.types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .filter(([, v]) => v > 0.05);
  const pills = topTypes.map(([k, v], i) =>
    `<span class="habitat-pill ${i > 0 ? 'secondary' : ''}">${escapeHTML(formatHabitatName(k))} ${Math.round(v * 100)}%</span>`
  ).join('');
  const sourceLabel = habitat.source === 'osm+sentinel' ? 'OSM + Sentinel-2' : habitat.source === 'sentinel' ? 'Sentinel-2' : 'OpenStreetMap';
  return `<div class="cond-card">
    <div class="cond-label"><span class="icon">${icon}</span> Habitat</div>
    <div class="cond-value" style="font-size:15px;padding-top:4px">${escapeHTML(habitat.label)}</div>
    <div class="cond-sub">${escapeHTML(habitat.description)}</div>
    <div class="habitat-pills">${pills}</div>
    <div style="font-size:10px;color:var(--muted);margin-top:6px">${sourceLabel}</div>
  </div>`;
}

function formatHabitatName(key) {
  const names = {
    forest: 'Forest', wetland: 'Wetland', grassland: 'Grassland',
    urban: 'Urban', farmland: 'Farmland', shrubland: 'Shrubland',
    water: 'Water', coastal: 'Coastal',
  };
  return names[key] || key;
}

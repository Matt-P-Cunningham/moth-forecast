import { state } from '../state.js';
import { ICONS } from '../icons.js';
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
  // Conditions tiles were removed. Data relocated to score breakdown sheet:
  //   moon phase + illum, moon rise/set, temperature, wind, cloud cover, time context.

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

// ─── Score breakdown sheet ────────────────────────────────────
function scoreBreakdown(h) {
  const tempPts = h.temp >= 65 && h.temp <= 80 ? 35
    : h.temp >= 55 ? 25
    : h.temp >= 50 ? 12
    : h.temp < 50 ? 0
    : 20;
  const windPts = h.wind < 5 ? 25 : h.wind < 10 ? 18 : h.wind < 15 ? 10 : 0;
  const moonPts = Math.round(h.moon.darkScore * 0.25);
  let multiplier = 1;
  let cloudVal;
  if (h.precip > 0) {
    multiplier = 0.3;
    cloudVal = `${h.precip.toFixed(2)}" rain`;
  } else if (h.clouds > 80) {
    multiplier = 0.85;
    cloudVal = `${h.clouds}% overcast`;
  } else {
    cloudVal = h.clouds < 10 ? 'Clear' : `${h.clouds}%`;
  }
  return { tempPts, windPts, moonPts, subtotal: tempPts + windPts + moonPts, multiplier, cloudVal };
}

function scoreSummary(h, bd) {
  if (h.isDay) return 'Daytime. Moths shelter during daylight hours — scoring not active.';
  if (h.precip > 0) return `Rain expected (${h.precip.toFixed(2)}"). Moths shelter during precipitation.`;
  const issues = [];
  if (h.temp < 50) issues.push('temperature is too cold for most species');
  else if (h.temp > 80) issues.push('temperature is unusually warm');
  if (h.wind >= 15) issues.push('winds are too strong');
  else if (h.wind >= 10) issues.push('moderate winds limiting flight');
  if (h.moon.darkScore < 30) issues.push('bright moon will reduce activity');
  else if (h.moon.darkScore < 55) issues.push('some moonlight present');
  if (h.clouds > 80) issues.push('heavy overcast reduces light trap effectiveness');
  if (bd.subtotal >= 70 && !issues.length) return 'Excellent conditions. Warm, calm, and dark — ideal for moth activity.';
  if (bd.subtotal >= 70) return `Good conditions overall. ${issues[0][0].toUpperCase()}${issues[0].slice(1)}.`;
  if (bd.subtotal >= 45) return issues.length ? `Fair conditions. ${issues[0][0].toUpperCase()}${issues[0].slice(1)}.` : 'Fair conditions. Some moths may be active.';
  return issues.length ? `Poor conditions. ${issues[0][0].toUpperCase()}${issues[0].slice(1)}.` : 'Poor conditions for moth activity.';
}

export function openScoreSheet() {
  if (document.getElementById('score-sheet')) return;
  const h = state.forecastHours[state.selectedIndex];
  if (!h) return;
  const bd = scoreBreakdown(h);
  const summary = scoreSummary(h, bd);

  // Time context (moved from conditions tile: time-of-night context was previously daytime-only)
  const hr12 = h.hour % 12 || 12;
  const ampm = h.hour < 12 ? 'AM' : 'PM';
  const timeStr = `${hr12}:00 ${ampm} · ${h.isDay ? 'Daytime' : 'Nighttime'}`;
  const timeRow = `<tr class="score-row-info"><td>Time</td><td>${timeStr}</td><td class="pts-col">—</td></tr>`;

  // Moon rise/set (moved from conditions tile: .cond-moon-times via calcMoonRiseSet)
  let moonRiseSet = '';
  if (state.currentLat != null && state.currentLng != null) {
    const { rise, set } = calcMoonRiseSet(h.y, h.mo, h.d, state.currentLat, state.currentLng);
    const parts = [rise ? `↑ ${fmtMoonTime(rise)}` : '', set ? `↓ ${fmtMoonTime(set)}` : ''].filter(Boolean);
    if (parts.length) moonRiseSet = parts.join(' · ');
  }
  const moonDetail = `${escapeHTML(h.moon.name)} · ${h.moon.illum}% lit${
    moonRiseSet ? `<br><span class="score-row-sub">${moonRiseSet}</span>` : ''}`;

  const tempVal = h.temp < 50 ? `${h.temp}°F — too cold`
    : h.temp > 80 ? `${h.temp}°F — very warm`
    : `${h.temp}°F`;

  const windVal = h.wind >= 15 ? `${h.wind} mph — too windy`
    : h.wind >= 10 ? `${h.wind} mph — moderate`
    : h.wind >= 5 ? `${h.wind} mph — light`
    : `${h.wind} mph — calm`;

  const cloudRow = bd.multiplier < 1
    ? `<tr class="score-row-penalty"><td>Clouds / Rain</td><td>${escapeHTML(bd.cloudVal)}</td><td class="pts-col">×${bd.multiplier}</td></tr>`
    : `<tr><td>Clouds / Rain</td><td>${escapeHTML(bd.cloudVal)}</td><td class="pts-col">—</td></tr>`;

  const bodyRows = h.isDay
    ? `${timeRow}<tr><td colspan="3" class="score-cell-note">Scoring paused — daytime. Score activates at dusk.</td></tr>`
    : `${timeRow}
       <tr><td>Moon</td><td>${moonDetail}</td><td class="pts-col">${bd.moonPts} / 25</td></tr>
       <tr><td>Temperature</td><td>${escapeHTML(tempVal)}</td><td class="pts-col">${bd.tempPts} / 35</td></tr>
       <tr><td>Wind</td><td>${escapeHTML(windVal)}</td><td class="pts-col">${bd.windPts} / 25</td></tr>
       ${cloudRow}`;

  const html = `
    <div id="score-sheet-backdrop" onclick="window.__mothApp.closeScoreSheet()"
         style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1100;animation:fadeIn .2s ease"></div>
    <div id="score-sheet" class="score-sheet">
      <div class="sheet-handle"></div>
      <div class="score-sheet-head">
        <span class="score-sheet-title">Score Breakdown</span>
        <button class="drawer-close" onclick="window.__mothApp.closeScoreSheet()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="score-sheet-body">
        <p class="score-sheet-summary">${escapeHTML(summary)}</p>
        <table class="score-table">
          <thead><tr><th>Factor</th><th>Conditions</th><th class="pts-col">Pts</th></tr></thead>
          <tbody>${bodyRows}</tbody>
          ${h.isDay ? '' : `<tfoot><tr class="score-total-row"><td colspan="2">Total score</td><td class="pts-col">${h.score} / 100</td></tr></tfoot>`}
        </table>
        ${h.isDay ? '' : '<p class="score-sheet-note">Base max: 85 pts (35 temp + 25 wind + 25 moon). Cloud and rain apply a multiplier to the total.</p>'}
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  const sheet = document.getElementById('score-sheet');
  let startY = 0;
  let swipeDelta = 0;
  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    swipeDelta = 0;
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0 && sheet.scrollTop === 0) {
      swipeDelta = d;
      sheet.style.transform = `translateY(${d}px)`;
    }
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    sheet.style.transition = '';
    if (swipeDelta > 100) {
      sheet.style.transform = 'translateY(110%)';
      setTimeout(closeScoreSheet, 220);
    } else {
      sheet.style.transform = '';
    }
  });
}

export function closeScoreSheet() {
  document.getElementById('score-sheet')?.remove();
  document.getElementById('score-sheet-backdrop')?.remove();
}

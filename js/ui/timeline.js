import { state } from '../state.js';
import { moonPhaseSVG } from '../icons.js';
import { escapeHTML, hourLabel, dayLabel } from '../utils.js';
import { renderConditions } from './conditions.js';
import { renderMoths } from './moths.js';

const COL_W = 44;
const SVG_H = 80;
const TOP_PAD = 12;
const BOT_PAD = 4;

function scoreY(score, isDay) {
  if (isDay) return SVG_H - BOT_PAD;
  return TOP_PAD + (1 - score / 100) * (SVG_H - TOP_PAD - BOT_PAD);
}

function splinePath(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
    const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
    const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
    const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function renderTimeline() {
  const wrap = document.getElementById('timeline-scroll');
  const hours = state.forecastHours;
  if (!hours.length) { wrap.innerHTML = ''; return; }

  const totalW = hours.length * COL_W;
  const pts = hours.map((h, i) => ({
    x: i * COL_W + COL_W / 2,
    y: scoreY(h.score, h.isDay)
  }));

  const linePath = splinePath(pts);
  const first = pts[0], last = pts[pts.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${SVG_H} L ${first.x.toFixed(1)} ${SVG_H} Z`;

  // Daytime shading
  const dayRects = hours.map((h, i) =>
    h.isDay ? `<rect x="${i * COL_W}" y="0" width="${COL_W}" height="${SVG_H}" class="tl-day-shade"/>` : ''
  ).join('');

  // Peak indicator
  let peakSvg = '';
  if (state.peakIndex >= 0 && state.peakIndex < pts.length) {
    const px = pts[state.peakIndex].x.toFixed(1);
    const py = pts[state.peakIndex].y;
    peakSvg = `<line class="tl-peak-vline" x1="${px}" y1="${(py + 6).toFixed(1)}" x2="${px}" y2="${SVG_H}"/>
      <text class="tl-peak-star" x="${px}" y="${(py - 3).toFixed(1)}" text-anchor="middle">★</text>`;
  }

  // Selected dot
  let selSvg = '';
  if (state.selectedIndex >= 0 && state.selectedIndex < pts.length) {
    const sp = pts[state.selectedIndex];
    selSvg = `<circle class="tl-sel-dot" cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="4"/>`;
  }

  // Transparent click rects
  const clickRects = hours.map((_, i) =>
    `<rect x="${i * COL_W}" y="0" width="${COL_W}" height="${SVG_H}" fill="none" style="cursor:pointer" onclick="window.__mothApp.selectHour(${i})"/>`
  ).join('');

  // Hour labels
  let lastDay = null;
  const labelsHtml = hours.map((h, i) => {
    const dl = dayLabel(h);
    const isNewDay = dl !== lastDay;
    lastDay = dl;
    let cls = 'tl-label';
    if (i === state.selectedIndex) cls += ' sel';
    if (i === state.nowIndex) cls += ' now';
    return `<div class="${cls}" style="width:${COL_W}px" onclick="window.__mothApp.selectHour(${i})">` +
      `<span class="tl-day-mark"${!isNewDay ? ' style="visibility:hidden"' : ''}>${escapeHTML(dl)}</span>` +
      `<span>${hourLabel(h)}</span></div>`;
  }).join('');

  wrap.innerHTML = `<div class="tl-chart-wrap" style="width:${totalW}px">` +
    `<svg class="tl-svg" width="${totalW}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.5"/>` +
    `<stop offset="100%" style="stop-color:var(--accent);stop-opacity:0.04"/>` +
    `</linearGradient></defs>` +
    `${dayRects}` +
    `<path class="tl-area" d="${areaPath}"/>` +
    `<path class="tl-line" d="${linePath}"/>` +
    `${peakSvg}${selSvg}${clickRects}` +
    `</svg>` +
    `<div class="tl-labels-row">${labelsHtml}</div>` +
    `</div>`;

  const selEl = wrap.querySelector('.tl-label.sel');
  if (selEl) selEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

export function selectHour(idx) {
  if (!state.forecastHours.length) return;
  idx = Math.max(0, Math.min(state.forecastHours.length - 1, idx));
  state.selectedIndex = idx;
  const h = state.forecastHours[idx];

  const d = new Date(h.y, h.mo - 1, h.d);
  document.getElementById('selected-time-label').textContent =
    `${dayLabel(h)}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  document.getElementById('prev-hour').disabled = idx <= 0;
  document.getElementById('next-hour').disabled = idx >= state.forecastHours.length - 1;

  document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(h.moon.fraction);

  renderTimeline();
  renderConditions(h);
  if (state.allMoths.length) renderMoths();
}

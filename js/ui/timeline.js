import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
import { escapeHTML, hourLabel, dayLabel, fullLabel } from '../utils.js';
import { renderConditions } from './conditions.js';
import { renderMoths } from './moths.js';

export function renderTimeline() {
  const wrap = document.getElementById('timeline-scroll');
  let lastDay = null;
  wrap.innerHTML = state.forecastHours.map((h, i) => {
    const dl = dayLabel(h);
    const showDay = dl !== lastDay;
    lastDay = dl;
    const barCls = h.isDay ? 'day' : h.level;
    const barH = h.isDay ? 4 : Math.max(4, Math.round(h.score / 100 * 50));
    const classes = ['tl-col'];
    if (i === state.selectedIndex) classes.push('selected');
    if (i === state.nowIndex) classes.push('now');
    return `<div class="${classes.join(' ')}" onclick="window.__mothApp.selectHour(${i})" title="${escapeHTML(fullLabel(h))} · ${h.score}/100">
      <div class="tl-day">${showDay ? escapeHTML(dl) : ' '}</div>
      <div class="tl-bar-wrap"><div class="tl-bar ${barCls}" style="height:${barH}px"></div></div>
      <div class="tl-time">${hourLabel(h)}</div>
      ${i === state.peakIndex ? `<span class="icon icon-sm tl-star">${ICONS.star}</span>` : ''}
    </div>`;
  }).join('');
  const sel = wrap.querySelector('.tl-col.selected');
  if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

export function updateMoonPill(h) {
  document.getElementById('moon-icon-pill').innerHTML = moonPhaseSVG(h.moon.fraction);
  document.getElementById('moon-name-pill').textContent = h.moon.name;
  document.getElementById('moon-illum-pill').textContent = `${h.moon.illum}% illuminated`;
  document.getElementById('moon-pill').style.display = 'flex';
  document.getElementById('header-moon-icon').innerHTML = moonPhaseSVG(h.moon.fraction);
}

export function selectHour(idx) {
  if (!state.forecastHours.length) return;
  idx = Math.max(0, Math.min(state.forecastHours.length - 1, idx));
  state.selectedIndex = idx;
  const h = state.forecastHours[idx];
  document.getElementById('selected-time-label').textContent = fullLabel(h);
  document.getElementById('peak-badge').style.display = (idx === state.peakIndex) ? 'inline-flex' : 'none';
  document.getElementById('prev-hour').disabled = idx <= 0;
  document.getElementById('next-hour').disabled = idx >= state.forecastHours.length - 1;
  renderTimeline();
  renderConditions(h);
  updateMoonPill(h);
  if (state.allMoths.length) renderMoths();
}

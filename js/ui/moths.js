import { state } from '../state.js';
import { ICONS } from '../icons.js';
import { escapeHTML, attr } from '../utils.js';
import { calcMothScore } from '../scoring.js';
import { lookupAffinity } from '../data/habitat-affinities.js';
import { hasSighting } from '../sightings.js';

const VIEW_MODE_KEY = 'moth-view-mode';

function getViewMode() {
  return localStorage.getItem(VIEW_MODE_KEY) || 'list';
}

export function setViewMode(mode) {
  localStorage.setItem(VIEW_MODE_KEY, mode);
  syncToggleButtons(mode);
  renderMoths();
}

function syncToggleButtons(mode) {
  document.getElementById('view-btn-list')?.classList.toggle('active', mode === 'list');
  document.getElementById('view-btn-grid')?.classList.toggle('active', mode === 'grid');
}

export function renderMoths() {
  const sort = document.getElementById('sort-sel').value;
  const freq = document.getElementById('freq-sel').value;
  const habitatFilter = document.getElementById('habitat-sel').value;
  let moths = [...state.allMoths];

  if (freq === 'common') moths = moths.filter(m => m.count > 100);
  else if (freq === 'occasional') moths = moths.filter(m => m.count > 20 && m.count <= 100);
  else if (freq === 'rare') moths = moths.filter(m => m.count <= 20);

  if (habitatFilter) {
    moths = moths.filter(m => lookupAffinity(m).includes(habitatFilter));
  }

  const h = state.forecastHours[state.selectedIndex];
  const nightScore = h ? h.score : 50;
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  moths.forEach(m => { m.flightScore = calcMothScore(m, nightScore); });

  if (sort === 'score') moths.sort((a, b) => b.flightScore - a.flightScore);
  else if (sort === 'count') moths.sort((a, b) => b.count - a.count);
  else moths.sort((a, b) => a.name.localeCompare(b.name));

  const mode = getViewMode();
  syncToggleButtons(mode);

  document.getElementById('result-count').textContent = `${moths.length} species`;
  const r = document.getElementById('results');
  if (!moths.length) {
    r.innerHTML = `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.search}</span>No moths match this filter.</div>`;
    return;
  }

  const listClass = mode === 'grid' ? 'species-list species-list--grid' : 'species-list';
  r.innerHTML = `<div class="${listClass}">` + moths.map(m => renderCard(m, currentMonth, mode)).join('') + '</div>';
}

function renderCard(m, currentMonth, mode) {
  const affinities = lookupAffinity(m);
  const scoreClass = m.flightScore >= 65 ? 'score-good' : m.flightScore >= 40 ? 'score-fair' : 'score-poor';

  const photoInner = m.photo?.url
    ? `<img src="${attr(m.photo.url)}" alt="${attr(m.name)}" loading="lazy" onerror="window.__mothApp.handleImgError(this)">`
    : `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;

  if (mode === 'grid') {
    return `<div class="species-card species-card--grid" onclick="window.__mothApp.openModal('${m.id}')">
      <div class="species-photo-top">${photoInner}</div>
      <div class="species-grid-body">
        <div class="species-common">${escapeHTML(m.name)}</div>
        <div class="species-sci">${escapeHTML(m.sci)}</div>
        <div class="species-grid-score">
          <span class="species-score ${scoreClass}">${m.flightScore}</span><span class="species-score-pct">%</span>
        </div>
      </div>
    </div>`;
  }

  // List mode
  const habitatTags = affinities.slice(0, 2).map(a => `<span class="habitat-tag">${escapeHTML(a)}</span>`).join('');
  const freqTag = m.count > 100
    ? '<span class="freq-tag freq-common">Common</span>'
    : m.count > 20 ? '<span class="freq-tag freq-occasional">Occasional</span>'
    : '<span class="freq-tag freq-rare">Rare</span>';
  const gbifBadge = m.source === 'gbif' ? '<span class="badge-gbif">GBIF</span>' : '';

  const logged = hasSighting(m.sci);
  const logBtn = `<button class="log-btn ${logged ? 'logged' : ''}"
    onclick="event.stopPropagation();window.__mothApp.logSighting('${m.id}')"
    title="${logged ? 'Logged tonight — tap to remove' : 'Log sighting'}">
    ${logged
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
  </button>`;

  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const inatBtn = inatId ? `<button class="card-inat-btn" onclick="event.stopPropagation();window.__mothApp.openInatObs('${inatId}','${attr(m.sci)}')" title="Log on iNaturalist">iNat ↗</button>` : '';

  return `<div class="species-card species-card--list" onclick="window.__mothApp.openModal('${m.id}')">
    <div class="species-thumb">${photoInner}</div>
    <div class="species-info">
      <div class="species-common">${escapeHTML(m.name)}</div>
      <div class="species-sci">${escapeHTML(m.sci)}</div>
      <div class="species-tags">${habitatTags}${freqTag}${gbifBadge}</div>
      <div class="species-card-actions">${inatBtn}</div>
    </div>
    <div class="species-score-col">
      <div class="species-score ${scoreClass}">${m.flightScore}</div>
      <div class="species-score-pct">%</div>
      ${logBtn}
    </div>
  </div>`;
}

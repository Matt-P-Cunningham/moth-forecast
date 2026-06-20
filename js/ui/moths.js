import { state } from '../state.js';
import { ICONS } from '../icons.js';
import { escapeHTML, attr, photoCreditText, seasonBars, estimateSeasonMonths } from '../utils.js';
import { calcMothScore } from '../scoring.js';
import { lookupAffinity } from '../data/habitat-affinities.js';

export function renderMoths() {
  const sort = document.getElementById('sort-sel').value;
  const freq = document.getElementById('freq-sel').value;
  const habitatFilter = document.getElementById('habitat-sel').value;
  let moths = [...state.allMoths];

  if (freq === 'common') moths = moths.filter(m => m.count > 100);
  else if (freq === 'occasional') moths = moths.filter(m => m.count > 20 && m.count <= 100);
  else if (freq === 'rare') moths = moths.filter(m => m.count <= 20);

  if (habitatFilter) {
    moths = moths.filter(m => {
      const affinity = lookupAffinity(m);
      return affinity.length === 0 || affinity.includes(habitatFilter);
    });
  }

  const h = state.forecastHours[state.selectedIndex];
  const nightScore = h ? h.score : 50;
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  moths.forEach(m => { m.flightScore = calcMothScore(m, nightScore); });

  if (sort === 'score') moths.sort((a, b) => b.flightScore - a.flightScore);
  else if (sort === 'count') moths.sort((a, b) => b.count - a.count);
  else moths.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('result-count').textContent = `${moths.length} species`;

  const r = document.getElementById('results');
  if (!moths.length) {
    r.innerHTML = `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.search}</span>No moths match this filter.</div>`;
    return;
  }

  r.innerHTML = '<div class="species-list">' +
    moths.map(m => renderCard(m, currentMonth)).join('') +
    '</div>';
}

function renderCard(m, currentMonth) {
  const affinities = lookupAffinity(m);
  const scoreClass = m.flightScore >= 65 ? 'score-good' : m.flightScore >= 40 ? 'score-fair' : 'score-poor';
  const credit = photoCreditText(m)
    ? `<div class="species-credit">${escapeHTML(photoCreditText(m))}</div>`
    : '';

  const photoHTML = m.photo && m.photo.url
    ? `<img src="${attr(m.photo.url)}" alt="${attr(m.name)}" loading="lazy" onerror="window.__mothApp.handleImgError(this)">${credit}`
    : `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;

  const habitatTags = affinities.slice(0, 2).map(a =>
    `<span class="habitat-tag">${escapeHTML(a)}</span>`
  ).join('');

  const freqTag = m.count > 100
    ? '<span class="freq-tag freq-common">Common</span>'
    : m.count > 20
    ? '<span class="freq-tag freq-occasional">Occasional</span>'
    : '<span class="freq-tag freq-rare">Rare</span>';

  const gbifBadge = (m.source === 'gbif') ? '<span class="badge-gbif">GBIF</span>' : '';

  return `<div class="species-card" onclick="window.__mothApp.openModal('${m.id}')">
    <div class="species-photo">${photoHTML}</div>
    <div class="species-info">
      <div class="species-common">${escapeHTML(m.name)}</div>
      <div class="species-sci">${escapeHTML(m.sci)}</div>
      <div class="species-tags">${habitatTags}${freqTag}${gbifBadge}</div>
      <div class="species-obs"><span class="icon icon-sm">${ICONS.eye}</span>${m.count.toLocaleString()} records</div>
    </div>
    <div class="species-score-col">
      <div class="species-score ${scoreClass}">${m.flightScore}</div>
      <div class="species-score-pct">%</div>
    </div>
  </div>`;
}

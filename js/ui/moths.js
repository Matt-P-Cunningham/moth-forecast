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

  if (habitatFilter && habitatFilter !== '') {
    moths = moths.filter(m => {
      const affinity = lookupAffinity(m);
      return affinity.length === 0 || affinity.includes(habitatFilter);
    });
  }

  const h = state.forecastHours[state.selectedIndex];
  const nightScore = h ? h.score : 50;
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  moths.forEach(m => m.flightScore = calcMothScore(m, nightScore));

  if (sort === 'score') moths.sort((a, b) => b.flightScore - a.flightScore);
  else if (sort === 'count') moths.sort((a, b) => b.count - a.count);
  else moths.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('result-count').textContent = `${moths.length} species`;
  const r = document.getElementById('results');
  if (!moths.length) {
    r.innerHTML = `<div class="empty"><span class="icon icon-xl icon-muted">${ICONS.search}</span>No moths match this filter.</div>`;
    return;
  }

  if (state.currentView === 'grid') renderGrid(moths, r, currentMonth);
  else renderList(moths, r, currentMonth);
}

export function setView(v) {
  state.currentView = v;
  document.getElementById('btn-grid').classList.toggle('active', v === 'grid');
  document.getElementById('btn-list').classList.toggle('active', v === 'list');
  renderMoths();
}

function imageHTML(moth, sizeClass) {
  if (!moth.photo || !moth.photo.url) {
    return `<span class="moth-silhouette">${ICONS.mothSilhouette}</span>`;
  }
  return `<img src="${attr(moth.photo.url)}" alt="${attr(moth.name)}" loading="lazy" onerror="window.__mothApp.handleImgError(this)">`;
}

function sourceBadge(moth) {
  if (moth.source === 'gbif') return '<span class="badge badge-gbif">GBIF</span>';
  return '';
}

function frequencyBadge(moth) {
  if (moth.count > 100) return '<span class="badge badge-common">Common</span>';
  if (moth.count > 20) return '<span class="badge badge-occasional">Occasional</span>';
  return '<span class="badge badge-rare">Rare</span>';
}

function inatLink(moth) {
  if (moth.source === 'gbif' && !moth.inatId) {
    return `<a class="moth-link" href="https://www.gbif.org/species/${moth.gbifKey}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><span class="icon">${ICONS.camera}</span>GBIF</a>`;
  }
  const id = moth.inatId || moth.id;
  return `<a class="moth-link" href="https://www.inaturalist.org/taxa/${id}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"><span class="icon">${ICONS.camera}</span>iNaturalist</a>`;
}

function renderGrid(moths, container, currentMonth) {
  container.innerHTML = '<div class="moth-grid">' + moths.map(m => {
    const { active, peak } = estimateSeasonMonths(currentMonth);
    const credit = photoCreditText(m) ? `<div class="photo-credit" title="${attr(photoCreditText(m))}">${escapeHTML(photoCreditText(m))}</div>` : '';
    return `<div class="moth-card" onclick="window.__mothApp.openModal('${m.id}')">
      <div class="moth-img">
        ${imageHTML(m, 'grid')}
        <div class="moth-likelihood">${m.flightScore}%</div>
        ${credit}
      </div>
      <div class="moth-body">
        <div class="moth-common">${escapeHTML(m.name)}</div>
        <div class="moth-sci">${escapeHTML(m.sci)}</div>
        <div class="moth-season">${seasonBars([...active,...peak], currentMonth)}</div>
        <div class="moth-footer">
          <span class="moth-obs"><span class="icon">${ICONS.eye}</span>${m.count.toLocaleString()}</span>
          ${frequencyBadge(m)} ${sourceBadge(m)}
        </div>
        <div class="moth-actions">
          ${inatLink(m)}
          <button class="share-btn" onclick="event.stopPropagation();window.__mothApp.shareMoth('${m.id}')"><span class="icon">${ICONS.link}</span>Share</button>
        </div>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function renderList(moths, container, currentMonth) {
  container.innerHTML = '<div class="moth-list">' + moths.map(m => {
    const { active, peak } = estimateSeasonMonths(currentMonth);
    const scoreClass = m.flightScore >= 60 ? '' : 'poor';
    const credit = photoCreditText(m) ? `<div class="list-credit">${escapeHTML(photoCreditText(m))}</div>` : '';
    return `<div class="moth-list-item" onclick="window.__mothApp.openModal('${m.id}')">
      <div class="list-img">${imageHTML(m, 'list')}</div>
      <div class="list-body">
        <div class="list-name">${escapeHTML(m.name)}</div>
        <div class="list-sci">${escapeHTML(m.sci)}</div>
        <div class="list-season">${seasonBars([...active,...peak], currentMonth)}</div>
        ${credit}
      </div>
      <div class="list-right">
        <div class="list-score ${scoreClass}">${m.flightScore}%</div>
        ${frequencyBadge(m)} ${sourceBadge(m)}
        <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px"><span class="icon">${ICONS.eye}</span>${m.count.toLocaleString()}</span>
      </div>
    </div>`;
  }).join('') + '</div>';
}

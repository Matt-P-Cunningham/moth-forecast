import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
import { escapeHTML, attr, fullLabel, estimateSeasonMonths } from '../utils.js';
import { calcMothScore } from '../scoring.js';
import { MONTHS_SHORT } from '../config.js';
import { lookupAffinity } from '../data/habitat-affinities.js';
import { hasSighting } from '../sightings.js';
import { showToast } from './toast.js';
import { fetchAllPhotos, licenseDisplay } from '../species/photos.js';
import { injectFieldNotes } from './field-notes.js';

export async function openModal(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;

  const inatIdForFetch = m.inatId || (m.source !== 'gbif' ? m.id : null);

  const h = state.forecastHours[state.selectedIndex];
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  const { active, peak } = estimateSeasonMonths(currentMonth);
  const nightScore = h ? h.score : 50;
  const fs = calcMothScore(m, nightScore);
  const scoreColor = fs >= 65 ? 'var(--accent-text)' : fs >= 40 ? 'var(--amber-text)' : 'var(--muted)';
  const scoreBorderColor = fs >= 65 ? 'var(--accent-dim)' : fs >= 40 ? 'var(--amber)' : 'var(--border2)';

  // ── 1. Photo section — skeleton; populated async ───────────────
  const photoSection = `<div id="modal-photo-section">
    <div class="modal-img"><div class="modal-photo-shimmer"></div></div>
  </div>`;

  // ── 2. Log Sighting button (primary action) ────────────────────
  const logged = hasSighting(m.sci);
  const logBtn = `<button id="modal-log-btn-${m.id}"
      class="${logged ? 'btn btn-logged modal-log-btn' : 'btn btn-primary modal-log-btn'}"
      onclick="window.__mothApp.logSighting('${m.id}')">
      ${logged ? '✓ Logged' : '+ Log Sighting'}
    </button>`;

  // ── 3. Flight likelihood ───────────────────────────────────────
  const scoreRow = `<div class="modal-score-row" style="border-left-color:${scoreBorderColor}">
    <div class="modal-score-num" style="color:${scoreColor}">${fs}%</div>
    <div class="modal-score-label">Estimated flight likelihood${h ? `<br>${escapeHTML(fullLabel(h))}` : ''}</div>
  </div>`;

  // ── 4. Flight season bar ───────────────────────────────────────
  const seasonSection = `<div class="modal-section">
    <h3>Flight Season</h3>
    <div class="modal-bar-wrap">${MONTHS_SHORT.map((mo, i) => {
      const mn = i + 1;
      const cls = peak.includes(mn) ? 'peak' : active.includes(mn) ? 'active' : '';
      return `<div class="modal-bar ${cls}" title="${mo}"></div>`;
    }).join('')}</div>
    <div class="modal-bar-months">${MONTHS_SHORT.map(mo =>
      `<div class="modal-bar-month">${mo[0]}</div>`
    ).join('')}</div>
  </div>`;

  // ── 5. Field Notes ─────────────────────────────────────────────
  const fieldNotesSection = `<div class="modal-section">
    <h3>Field Notes</h3>
    ${inatIdForFetch
      ? `<div id="modal-field-notes-body" class="field-notes-skeleton" data-taxon-id="${inatIdForFetch}">
           <div class="field-notes-skel-bar" style="width:88%"></div>
           <div class="field-notes-skel-bar" style="width:72%"></div>
           <div class="field-notes-skel-bar" style="width:55%"></div>
         </div>`
      : `<p class="field-notes-unavailable">Field notes unavailable.</p>`}
  </div>`;

  // ── 6. Habitat affinity ────────────────────────────────────────
  const affinities = lookupAffinity(m);
  const habitatRow = affinities.length
    ? `<div class="modal-section"><h3>Habitat Affinity</h3>
       <div class="habitat-pills-row">${affinities.map(a => `<span class="habitat-pill">${escapeHTML(a)}</span>`).join('')}</div></div>`
    : '';

  // ── 7. Observation data ───────────────────────────────────────
  const statsSection = `<div class="modal-section">
    <h3>Observation Data</h3>
    <div class="modal-stats">
      <div class="modal-stat">
        <div class="modal-stat-label">Records nearby</div>
        <div class="modal-stat-value">${m.count.toLocaleString()}</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-label">Source</div>
        <div class="modal-stat-value">${m.source === 'both' ? 'iNat + GBIF' : m.source === 'gbif' ? 'GBIF' : 'iNaturalist'}</div>
      </div>
    </div>
  </div>`;

  // ── 8. Links ──────────────────────────────────────────────────
  const inatId = inatIdForFetch;
  const gbifKey = m.gbifKey;

  const linksSection = `<div class="modal-section">
    <h3>Links</h3>
    <div class="modal-links">
      ${inatId ? `<a class="modal-link" href="https://www.inaturalist.org/taxa/${inatId}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.camera}</span>iNaturalist</a>` : ''}
      ${gbifKey ? `<a class="modal-link" href="https://www.gbif.org/species/${gbifKey}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.link}</span>GBIF</a>` : ''}
      <a class="modal-link" href="https://bugguide.net/index.php?q=search&keys=${encodeURIComponent(m.sci)}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.bug}</span>BugGuide</a>
    </div>
  </div>`;

  // ── 9. Sticky action bar ──────────────────────────────────────
  const stickyBar = `<div class="modal-sticky-bar">
    ${inatId ? `<button class="btn btn-sm" onclick="window.__mothApp.openInatObs('${inatId}','${attr(m.sci)}')">iNat ↗</button>` : ''}
    <button class="btn btn-sm" onclick="window.__mothApp.shareMoth('${m.id}')">Share</button>
  </div>`;

  const html = `<div class="modal-overlay" onclick="if(event.target===this)window.__mothApp.closeModal()">
    <div class="modal">
      <div class="sheet-handle" style="margin:10px auto 0"></div>
      <button class="modal-close" onclick="window.__mothApp.closeModal()" aria-label="Close">
        <span class="icon">${ICONS.x}</span>
      </button>
      ${photoSection}
      <div class="modal-log-section">
        ${logBtn}
      </div>
      <div class="modal-name-block">
        <div class="modal-title">${escapeHTML(m.name)}</div>
        <div class="modal-sci">${escapeHTML(m.sci)}</div>
      </div>
      ${scoreRow}
      ${seasonSection}
      ${fieldNotesSection}
      ${habitatRow}
      ${statsSection}
      ${linksSection}
      <p class="modal-disclaimer">This app uses live third-party APIs and a simplified heuristic model. It is a field-planning aid, not a verified biological forecast.</p>
      ${stickyBar}
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

  // Photos: fetch all sources in parallel, inject when ready; instant if session-cached
  fetchAllPhotos(inatIdForFetch, m.gbifKey, m.sci).then(photoSet => {
    m.photoSet = photoSet;
    if (document.getElementById('modal-photo-section')) {
      renderModalPhotoSection(photoSet, m);
    }
  });

  if (inatIdForFetch) injectFieldNotes(inatIdForFetch);

  // Swipe-down to dismiss
  const overlayEl = document.querySelector('.modal-overlay');
  const modalEl = overlayEl.querySelector('.modal');
  let swipeStartY = 0;
  let swipeDelta = 0;

  overlayEl.addEventListener('touchstart', e => {
    swipeStartY = e.touches[0].clientY;
    swipeDelta = 0;
    modalEl.style.transition = 'none';
  }, { passive: true });

  overlayEl.addEventListener('touchmove', e => {
    const delta = e.touches[0].clientY - swipeStartY;
    if (delta > 0 && modalEl.scrollTop <= 0) {
      swipeDelta = delta;
      modalEl.style.transform = `translateY(${delta}px)`;
    }
  }, { passive: true });

  overlayEl.addEventListener('touchend', () => {
    modalEl.style.transition = '';
    if (swipeDelta > 120) {
      closeModal();
    } else {
      modalEl.style.transform = '';
    }
  });
}

export function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

export function swapModalPhoto(btn) {
  const url = btn.dataset.url;
  const credit = btn.dataset.credit;
  const mainImg = document.getElementById('modal-main-img');
  const mainWrap = document.getElementById('modal-main-img-wrap');
  const creditEl = document.getElementById('modal-photo-credit');
  if (mainImg) mainImg.src = url;
  if (mainWrap) mainWrap.dataset.src = url;
  if (creditEl) creditEl.textContent = credit || '';
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.toggle('active', t === btn));
}

// ── Photo section rendering ─────────────────────────────────────

function renderModalPhotoSection(photoSet, m) {
  const section = document.getElementById('modal-photo-section');
  if (!section) return;
  section.innerHTML = buildPhotoSectionHtml(photoSet, m);
}

function buildPhotoSectionHtml({ adult, caterpillar, additional }, m) {
  let html = '';

  // Adult photo
  if (adult) {
    html += `<div class="modal-img modal-img-tappable" id="modal-main-img-wrap"
        data-src="${attr(adult.url)}" data-alt="${attr(m.name)}"
        onclick="window.__mothApp.openLightbox(this.dataset.src,this.dataset.alt)">
      <img id="modal-main-img" src="${attr(adult.url)}" alt="${attr(m.name)}" loading="lazy" onerror="window.__mothApp.handleImgError(this)">
      <span class="modal-photo-stage-label">Adult</span>
    </div>
    ${photoCredit(adult, 'modal-photo-credit')}`;
  } else {
    html += `<div class="modal-img" id="modal-main-img-wrap">
      <span class="moth-silhouette" style="width:80px;height:80px;opacity:0.15">${ICONS.mothSilhouette}</span>
    </div>
    <div class="modal-photo-credit" id="modal-photo-credit"></div>`;
  }

  // Additional photos strip
  if (additional.length > 0) {
    html += `<div class="modal-photo-strip">`;
    for (const p of additional) {
      html += `<button class="modal-thumb" data-url="${attr(p.url)}" data-credit="${attr(buildCreditStr(p))}"
          onclick="window.__mothApp.swapModalPhoto(this)">
        <img src="${attr(p.squareUrl || p.url)}" alt="" loading="lazy">
      </button>`;
    }
    html += `</div>`;
  }

  // Caterpillar / larval section — always shown so users know we looked
  html += `<div class="modal-larval-section">`;
  html += `<p class="modal-larval-heading">Larval Stage</p>`;
  if (caterpillar) {
    html += `<div class="modal-img modal-img-tappable"
        data-src="${attr(caterpillar.url)}" data-alt="${attr(m.name)} larva"
        onclick="window.__mothApp.openLightbox(this.dataset.src,this.dataset.alt)">
      <img src="${attr(caterpillar.url)}" alt="${attr(m.name)} larva" loading="lazy" onerror="window.__mothApp.handleImgError(this)">
      <span class="modal-photo-stage-label modal-photo-stage-larva">Larva / Caterpillar</span>
    </div>
    ${photoCredit(caterpillar)}`;
  } else {
    html += `<div class="modal-larval-placeholder">Larval photo not yet available</div>`;
  }
  html += `</div>`;

  return html;
}

function photoCredit(photo, id = '') {
  const parts = [];
  if (photo.attribution) parts.push(`© ${escapeHTML(photo.attribution)}`);
  if (photo.license) parts.push(escapeHTML(licenseDisplay(photo.license)));
  parts.push(escapeHTML(photo.source));
  return `<div class="modal-photo-credit"${id ? ` id="${id}"` : ''}>${parts.join(' · ')}</div>`;
}

function buildCreditStr(photo) {
  const parts = [];
  if (photo.attribution) parts.push(`© ${photo.attribution}`);
  if (photo.license) parts.push(licenseDisplay(photo.license));
  parts.push(photo.source);
  return parts.join(' · ');
}

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

// Module-level photo state for swipe/switch
let _currentPhotos = [];

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

  // ── 2. Flight likelihood ───────────────────────────────────────
  const scoreRow = `<div class="modal-score-row" style="border-left-color:${scoreBorderColor}">
    <div class="modal-score-num" style="color:${scoreColor}">${fs}%</div>
    <div class="modal-score-label">Estimated flight likelihood${h ? `<br>${escapeHTML(fullLabel(h))}` : ''}</div>
  </div>`;

  // ── 3. Flight season bar ───────────────────────────────────────
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

  // ── 4. Field Notes ─────────────────────────────────────────────
  const fieldNotesSection = inatIdForFetch
    ? `<div class="modal-section">
         <h3>Field Notes</h3>
         <div id="modal-field-notes-body" class="field-notes-skeleton" data-taxon-id="${inatIdForFetch}">
           <div class="field-notes-skel-bar" style="width:88%"></div>
           <div class="field-notes-skel-bar" style="width:72%"></div>
           <div class="field-notes-skel-bar" style="width:55%"></div>
         </div>
       </div>
       <p id="modal-obs-count" class="modal-obs-count"></p>`
    : '';

  // ── 5. Habitat affinity ────────────────────────────────────────
  const affinities = lookupAffinity(m);
  const habitatRow = affinities.length
    ? `<div class="modal-section"><h3>Habitat Affinity</h3>
       <div class="habitat-pills-row">${affinities.map(a => `<span class="habitat-pill">${escapeHTML(a)}</span>`).join('')}</div></div>`
    : '';

  // ── 6. Observation data ────────────────────────────────────────
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

  // ── 7. Links ───────────────────────────────────────────────────
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

  // ── 8. Sticky action bar (Log + iNat + Share) ─────────────────
  const logged = hasSighting(m.sci);
  const stickyBar = `<div class="modal-sticky-bar">
    <button id="modal-log-btn-${m.id}"
        class="${logged ? 'btn btn-logged' : 'btn btn-primary'} modal-sticky-log"
        onclick="window.__mothApp.logSighting('${m.id}')">
      ${logged ? '✓ Logged' : '+ Log Sighting'}
    </button>
    ${inatId ? `<button class="btn modal-sticky-outline" onclick="window.__mothApp.openInatObs('${inatId}','${attr(m.sci)}')">iNat ↗</button>` : ''}
    <button class="btn modal-sticky-outline" onclick="window.__mothApp.shareMoth('${m.id}')">Share</button>
  </div>`;

  const html = `<div class="modal-overlay" onclick="if(event.target===this)window.__mothApp.closeModal()">
    <div class="modal">
      <div class="sheet-handle" style="margin:10px auto 0"></div>
      <button class="modal-close" onclick="window.__mothApp.closeModal()" aria-label="Close">
        <span class="icon">${ICONS.x}</span>
      </button>
      ${photoSection}
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
    if (swipeDelta > 80) {
      closeModal();
    } else {
      modalEl.style.transition = 'transform 0.2s ease';
      modalEl.style.transform = '';
    }
  });
}

export function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  _currentPhotos = [];
}

export function switchPhoto(index) {
  if (index < 0 || index >= _currentPhotos.length) return;
  const photo = _currentPhotos[index];

  const mainImg  = document.getElementById('modal-main-img');
  const mainWrap = document.getElementById('modal-main-img-wrap');
  const creditEl = document.getElementById('modal-photo-credit');
  const labelEl  = document.getElementById('modal-photo-stage-label');

  if (mainImg) mainImg.src = photo.url;
  if (mainWrap) {
    mainWrap.dataset.src = photo.url;
    mainWrap.dataset.activeIndex = String(index);
  }
  if (creditEl) {
    const parts = [];
    if (photo.attribution) parts.push(`© ${photo.attribution}`);
    if (photo.license) parts.push(licenseDisplay(photo.license));
    parts.push(photo.source);
    creditEl.textContent = parts.join(' · ');
  }
  if (labelEl) {
    const label = getPhotoTypeLabel(photo);
    labelEl.textContent = label || '';
    labelEl.style.display = label ? '' : 'none';
  }

  document.querySelectorAll('.modal-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === index);
  });
}

// ── Photo section rendering ─────────────────────────────────────

function renderModalPhotoSection(photoSet, m) {
  const section = document.getElementById('modal-photo-section');
  if (!section) return;
  section.innerHTML = buildPhotoSectionHtml(photoSet, m);
  attachPhotoSwipe();
}

function buildPhotoSectionHtml({ adult, caterpillar, additional }, m) {
  const photos = [];
  if (adult) photos.push({ ...adult });
  for (const p of additional) photos.push({ ...p });
  if (caterpillar) photos.push({ ...caterpillar });
  _currentPhotos = photos;

  if (!photos.length) {
    return `<div class="modal-img" id="modal-main-img-wrap" data-active-index="0">
      <span class="moth-silhouette" style="width:80px;height:80px;opacity:0.15">${ICONS.mothSilhouette}</span>
    </div>
    <div class="modal-photo-credit" id="modal-photo-credit"></div>`;
  }

  const first = photos[0];
  const firstLabel = getPhotoTypeLabel(first);

  let html = `<div class="modal-img modal-img-tappable" id="modal-main-img-wrap"
      data-src="${attr(first.url)}" data-alt="${attr(m.name)}"
      data-active-index="0"
      onclick="window.__mothApp.openPhotoLightbox(parseInt(this.dataset.activeIndex||'0'))">
    <img id="modal-main-img" src="${attr(first.url)}" alt="${attr(m.name)}" loading="lazy" onerror="window.__mothApp.handleImgError(this)">
    <span class="modal-photo-stage-label" id="modal-photo-stage-label"${firstLabel ? '' : ' style="display:none"'}>${firstLabel || ''}</span>
  </div>
  ${photoCredit(first, 'modal-photo-credit')}`;

  if (photos.length > 1) {
    html += `<div class="modal-photo-strip" id="modal-photo-strip">`;
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      html += `<button class="modal-thumb${i === 0 ? ' active' : ''}"
          data-index="${i}"
          onclick="window.__mothApp.switchPhoto(${i})">
        <img src="${attr(p.squareUrl || p.url)}" alt="" loading="lazy">
      </button>`;
    }
    html += `</div>`;
  }

  return html;
}

function attachPhotoSwipe() {
  const wrap = document.getElementById('modal-main-img-wrap');
  if (!wrap || _currentPhotos.length < 2) return;
  let startX = 0;
  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    const curr = parseInt(wrap.dataset.activeIndex || '0');
    const next = dx < 0
      ? (curr + 1) % _currentPhotos.length
      : (curr - 1 + _currentPhotos.length) % _currentPhotos.length;
    window.__mothApp.switchPhoto(next);
  }, { passive: true });
}

function getPhotoTypeLabel(photo) {
  if (photo.type === 'caterpillar') return 'Larva / Caterpillar';
  if (photo.type === 'adult') return 'Adult';
  return null;
}

// ── Photo lightbox with swipe-through ──────────────────────────

export function openPhotoLightbox(initialIndex = 0) {
  if (!_currentPhotos.length) return;
  let lbIdx = Math.min(Math.max(0, initialIndex), _currentPhotos.length - 1);
  let swipeHandled = false;

  function buildInner() {
    const p = _currentPhotos[lbIdx];
    const label = getPhotoTypeLabel(p);
    const dotsHtml = _currentPhotos.length > 1
      ? `<div class="lb-dots">${_currentPhotos.map((_, i) =>
          `<span class="lb-dot${i === lbIdx ? ' active' : ''}"></span>`
        ).join('')}</div>`
      : '';
    return `<img src="${attr(p.url)}" alt="" class="lightbox-img" id="lb-img">
      ${label ? `<span class="lb-type-label">${escapeHTML(label)}</span>` : ''}
      ${dotsHtml}`;
  }

  function closeLb() {
    lb.remove();
    const currentActive = parseInt(
      document.getElementById('modal-main-img-wrap')?.dataset.activeIndex || '0'
    );
    if (lbIdx !== currentActive) switchPhoto(lbIdx);
  }

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = buildInner();
  document.body.appendChild(lb);

  lb.addEventListener('click', e => {
    if (swipeHandled) { swipeHandled = false; return; }
    if (e.target === lb) closeLb();
  });

  let startX = 0, startY = 0, intentH = null, swipeDeltaY = 0;

  lb.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    intentH = null;
    swipeDeltaY = 0;
    lb.style.transition = 'none';
  }, { passive: true });

  lb.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (intentH === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      intentH = Math.abs(dx) >= Math.abs(dy);
    }
    if (intentH === false && dy > 0) {
      swipeDeltaY = dy;
      lb.style.transform = `translateY(${dy}px)`;
      lb.style.opacity = String(Math.max(0.3, 1 - dy / 250));
    }
  }, { passive: true });

  lb.addEventListener('touchend', e => {
    if (intentH === false && swipeDeltaY > 80) {
      lb.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      lb.style.transform = 'translateY(100%)';
      lb.style.opacity = '0';
      swipeHandled = true;
      setTimeout(closeLb, 200);
      return;
    }
    lb.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    lb.style.transform = '';
    lb.style.opacity = '';
    if (intentH === true) {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) >= 40) {
        swipeHandled = true;
        lbIdx = dx < 0
          ? (lbIdx + 1) % _currentPhotos.length
          : (lbIdx - 1 + _currentPhotos.length) % _currentPhotos.length;
        lb.innerHTML = buildInner();
      }
    }
  }, { passive: true });
}

function photoCredit(photo, id = '') {
  const parts = [];
  if (photo.attribution) parts.push(`© ${escapeHTML(photo.attribution)}`);
  if (photo.license) parts.push(escapeHTML(licenseDisplay(photo.license)));
  parts.push(escapeHTML(photo.source));
  return `<div class="modal-photo-credit"${id ? ` id="${id}"` : ''}>${parts.join(' · ')}</div>`;
}

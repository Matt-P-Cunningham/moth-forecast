import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
import { escapeHTML, attr, photoCreditText, photoCreditHTML, fullLabel, estimateSeasonMonths } from '../utils.js';
import { calcMothScore } from '../scoring.js';
import { MONTHS_SHORT } from '../config.js';
import { lookupAffinity } from '../data/habitat-affinities.js';
import { hasSighting } from '../sightings.js';
import { showToast } from './toast.js';
import { fetchGBIFPhoto } from '../species/gbif.js';

export async function openModal(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;

  if (!m.photo && m.gbifKey) {
    m.photo = await fetchGBIFPhoto(m.gbifKey);
  }

  const h = state.forecastHours[state.selectedIndex];
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  const { active, peak } = estimateSeasonMonths(currentMonth);
  const nightScore = h ? h.score : 50;
  const fs = calcMothScore(m, nightScore);
  const scoreColor = fs >= 65 ? 'var(--accent-text)' : fs >= 40 ? 'var(--amber-text)' : 'var(--muted)';
  const scoreBorderColor = fs >= 65 ? 'var(--accent-dim)' : fs >= 40 ? 'var(--amber)' : 'var(--border2)';

  const img = m.photo && m.photo.url
    ? `<div class="modal-img modal-img-tappable"
           data-src="${attr(m.photo.url)}"
           data-alt="${attr(m.name)}"
           onclick="window.__mothApp.openLightbox(this.dataset.src,this.dataset.alt)">
         <img src="${attr(m.photo.url)}" alt="${attr(m.name)}" onerror="window.__mothApp.handleImgError(this)">
       </div>`
    : `<div class="modal-img"><span class="moth-silhouette" style="width:80px;height:80px;opacity:0.15">${ICONS.mothSilhouette}</span></div>`;

  const credit = photoCreditText(m)
    ? `<div class="modal-photo-credit">${photoCreditHTML(m)}</div>`
    : `<div class="modal-photo-credit">No license metadata from API. Verify before reusing images.</div>`;

  const affinities = lookupAffinity(m);
  const habitatRow = affinities.length
    ? `<div class="modal-section"><h3>Habitat affinity</h3>
       <div class="habitat-pills-row">${affinities.map(a => `<span class="habitat-pill">${escapeHTML(a)}</span>`).join('')}</div></div>`
    : '';

  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const gbifKey = m.gbifKey;

  const html = `<div class="modal-overlay" onclick="if(event.target===this)window.__mothApp.closeModal()">
    <div class="modal">
      <div class="sheet-handle" style="margin:10px auto 0"></div>
      ${img}
      ${credit}
      <button class="modal-close" onclick="window.__mothApp.closeModal()" aria-label="Close">
        <span class="icon">${ICONS.x}</span>
      </button>
      <div class="modal-body">
        <div class="modal-title">${escapeHTML(m.name)}</div>
        <div class="modal-sci">${escapeHTML(m.sci)}</div>
        <div class="modal-score-row" style="border-left-color:${scoreBorderColor}">
          <div class="modal-score-num" style="color:${scoreColor}">${fs}%</div>
          <div class="modal-score-label">estimated flight likelihood<br>${h ? escapeHTML(fullLabel(h)) : ''}</div>
        </div>
        <div class="modal-section">
          <h3>Flight season (estimated)</h3>
          <div class="modal-bar-wrap">${MONTHS_SHORT.map((mo, i) => {
            const mn = i + 1;
            const cls = peak.includes(mn) ? 'peak' : active.includes(mn) ? 'active' : '';
            return `<div class="modal-bar ${cls}" title="${mo}"></div>`;
          }).join('')}</div>
          <div class="modal-bar-months">${MONTHS_SHORT.map(mo =>
            `<div class="modal-bar-month">${mo[0]}</div>`
          ).join('')}</div>
        </div>
        ${habitatRow}
        <div class="modal-section">
          <h3>Observation data</h3>
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
        </div>
        <div class="modal-section">
          <h3>Links</h3>
          <div class="modal-links">
            ${inatId ? `<a class="modal-link" href="https://www.inaturalist.org/taxa/${inatId}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.camera}</span>iNaturalist</a>` : ''}
            ${gbifKey ? `<a class="modal-link" href="https://www.gbif.org/species/${gbifKey}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.link}</span>GBIF</a>` : ''}
            <a class="modal-link" href="https://www.butterfliesandmoths.org/search?field_bam_description_value=${encodeURIComponent(m.sci)}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.leaf}</span>BAMONA</a>
            <a class="modal-link" href="https://bugguide.net/index.php?q=search&keys=${encodeURIComponent(m.sci)}" target="_blank" rel="noopener noreferrer"><span class="icon">${ICONS.bug}</span>BugGuide</a>
          </div>
        </div>
        <div class="disclaimer">
          This app uses live third-party APIs and a simplified heuristic model. It is a field-planning aid, not a verified biological forecast.
        </div>
        <div class="modal-actions">
          ${(() => {
            const logged = hasSighting(m.sci);
            const cls = logged ? 'btn btn-sm btn-logged' : 'btn btn-primary btn-sm';
            const icon = logged
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
            const label = logged ? 'Logged' : 'Log sighting';
            return `<button id="modal-log-btn-${m.id}" class="${cls}" style="flex:1" onclick="window.__mothApp.logSighting('${m.id}')"><span class="icon">${icon}</span>${label}</button>`;
          })()}
          ${inatId ? `<button class="btn btn-sm" onclick="window.__mothApp.openInatObs('${inatId}','${attr(m.sci)}')">iNat ↗</button>` : ''}
          <button class="btn btn-sm" onclick="window.__mothApp.shareMoth('${m.id}')">Share</button>
          <button class="btn btn-sm" onclick="window.__mothApp.closeModal()">✕</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

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

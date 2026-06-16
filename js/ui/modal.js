import { state } from '../state.js';
import { ICONS, moonPhaseSVG } from '../icons.js';
import { escapeHTML, attr, photoCreditText, photoCreditHTML, fullLabel, estimateSeasonMonths } from '../utils.js';
import { calcMothScore } from '../scoring.js';
import { MONTHS_SHORT } from '../config.js';
import { lookupAffinity } from '../data/habitat-affinities.js';
import { showToast } from './toast.js';

export function openModal(id) {
  const m = state.allMoths.find(x => String(x.id) === String(id));
  if (!m) return;
  const h = state.forecastHours[state.selectedIndex];
  const currentMonth = h ? h.mo : (new Date().getMonth() + 1);
  const { active, peak } = estimateSeasonMonths(currentMonth);
  const nightScore = h ? h.score : 50;
  const fs = calcMothScore(m, nightScore);
  const scoreColor = fs >= 70 ? 'var(--accent)' : fs >= 45 ? '#ef9f27' : 'var(--muted)';

  const img = m.photo && m.photo.url
    ? `<div class="modal-img"><img src="${attr(m.photo.url)}" alt="${attr(m.name)}" onerror="window.__mothApp.handleImgError(this)"></div>`
    : `<div class="modal-img"><span class="icon icon-xl">${ICONS.bug}</span></div>`;

  const credit = photoCreditText(m)
    ? `<div class="modal-photo-credit">${photoCreditHTML(m)}</div>`
    : `<div class="modal-photo-credit">No embedded photo license metadata was provided by the API. Use the source link before reusing any image.</div>`;

  const affinities = lookupAffinity(m);
  const habitatRow = affinities.length
    ? `<div class="modal-section"><h3>Habitat affinity</h3><div class="habitat-pills">${affinities.map(a=>`<span class="habitat-pill">${escapeHTML(a)}</span>`).join('')}</div></div>`
    : '';

  const inatId = m.inatId || (m.source !== 'gbif' ? m.id : null);
  const gbifKey = m.gbifKey;

  const html = `<div class="modal-overlay" onclick="if(event.target===this)window.__mothApp.closeModal()">
    <div class="modal">
      ${img}
      ${credit}
      <button class="modal-close" onclick="window.__mothApp.closeModal()" aria-label="Close"><span class="icon">${ICONS.x}</span></button>
      <div class="modal-body">
        <div class="modal-title">${escapeHTML(m.name)}</div>
        <div class="modal-sci">${escapeHTML(m.sci)}</div>
        <div class="modal-score-row">
          <div class="modal-score-num" style="color:${scoreColor}">${fs}%</div>
          <div class="modal-score-label">estimated flight likelihood<br>${h ? escapeHTML(fullLabel(h)) : ''}</div>
        </div>
        <div class="modal-section">
          <h3>Flight season (estimated)</h3>
          <div class="modal-bar-wrap">${MONTHS_SHORT.map((mo,i)=>{
            const mn=i+1;
            const cls=peak.includes(mn)?'peak':active.includes(mn)?'active':'';
            return `<div class="modal-bar ${cls}" title="${mo}"></div>`;
          }).join('')}</div>
          <div style="display:flex;gap:0;margin-top:4px">${MONTHS_SHORT.map(mo=>`<div style="flex:1;text-align:center;font-size:9px;color:var(--muted)">${mo[0]}</div>`).join('')}</div>
        </div>
        ${habitatRow}
        <div class="modal-section">
          <h3>Observation data</h3>
          <div class="modal-stats">
            <div class="modal-stat"><div class="modal-stat-label">Records nearby</div><div class="modal-stat-value">${m.count.toLocaleString()}</div></div>
            <div class="modal-stat"><div class="modal-stat-label">Source</div><div class="modal-stat-value">${m.source === 'gbif' ? 'GBIF' : 'iNaturalist'}</div></div>
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
          This app uses live third-party APIs and a simplified likelihood model. It is a field-planning aid, not a verified biological forecast. Review each provider's current API terms for production use.
        </div>
        <div style="display:flex;gap:8px;margin-top:1rem">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="window.__mothApp.shareMoth('${m.id}');window.__mothApp.closeModal()"><span class="icon">${ICONS.link}</span>Share this moth</button>
          <button class="btn btn-sm" onclick="window.__mothApp.closeModal()">Close</button>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

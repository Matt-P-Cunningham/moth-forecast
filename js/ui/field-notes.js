import { INATURALIST_API } from '../config.js';
import { escapeHTML } from '../utils.js';

const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const cache = new Map();

export async function injectFieldNotes(taxonId) {
  const container = document.getElementById('modal-field-notes-body');
  if (!container || container.dataset.taxonId !== String(taxonId)) return;

  let notes;
  if (cache.has(taxonId)) {
    notes = cache.get(taxonId);
  } else {
    notes = await fetchNotes(taxonId);
    cache.set(taxonId, notes);
  }

  // Guard: modal may have closed while fetching
  const still = document.getElementById('modal-field-notes-body');
  if (!still || still.dataset.taxonId !== String(taxonId)) return;

  still.className = '';
  still.innerHTML = renderNotes(notes);
}

// ── Fetch ───────────────────────────────────────────────────────

async function fetchNotes(taxonId) {
  try {
    const res = await fetch(`${INATURALIST_API}/taxa/${taxonId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const taxon = data.results?.[0];
    if (!taxon) return null;

    // Fetch Wikipedia in parallel with data processing (non-fatal if fails)
    let wikiExtract = null;
    const wikiUrl = taxon.wikipedia_url || '';
    if (wikiUrl.includes('en.wikipedia.org/wiki/')) {
      const rawTitle = wikiUrl.split('/wiki/')[1] || '';
      if (rawTitle) {
        try {
          const wr = await fetch(`${WIKIPEDIA_SUMMARY}/${encodeURIComponent(rawTitle)}`);
          if (wr.ok) {
            const wd = await wr.json();
            wikiExtract = wd.extract || null;
          }
        } catch { /* non-fatal */ }
      }
    }

    const taxonomy      = extractTaxonomy(taxon);
    const description   = pickDescription(taxon, wikiExtract, taxonomy);
    const hostPlants    = extractHostPlants(taxon, wikiExtract);
    const conservation  = getConservationStatus(taxon);
    const obsCount      = taxon.observations_count ?? null;

    return { description, taxonomy, hostPlants, conservation, obsCount };
  } catch {
    return null;
  }
}

// ── Description priority ────────────────────────────────────────
// 1. iNat's own wikipedia_summary (curated, often cleaner)
// 2. taxon_notes from iNat curators
// 3. Wikipedia extract if >80 words and not a circular stub
// 4. null — let taxonomy row anchor the card

function pickDescription(taxon, wikiExtract, taxonomy) {
  // 1. iNat stored summary
  const inatSummary = (taxon.wikipedia_summary || '').trim();
  if (isUsableDescription(inatSummary)) return truncateSentences(inatSummary, 3);

  // 2. Curator taxon notes (may contain HTML)
  const curatorNotes = stripHtml(taxon.taxon_notes || '').trim();
  if (isUsableDescription(curatorNotes)) return truncateSentences(curatorNotes, 3);

  // 3. Wikipedia — only if substantive and not a taxonomic stub
  if (wikiExtract && isUsableDescription(wikiExtract)) {
    return truncateSentences(wikiExtract, 3);
  }

  return null;
}

// Rejects: < 20 words, or short texts that are just "[name] is a moth of the family X"
function isUsableDescription(text) {
  if (!text) return false;
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 20) return false;
  // For short-medium texts, reject circular taxonomic placements
  if (wordCount < 80) {
    if (/^[^.!?]+\s+is\s+an?\s+(moth|butterfly|insect|species|member)\s+(of|in)\s+the\s+(family|genus|order|tribe)/i.test(text.trim())) {
      return false;
    }
  }
  return true;
}

function truncateSentences(text, max) {
  const sents = text.match(/[^.!?]*[.!?]+/g);
  if (!sents) return text.length > 400 ? text.slice(0, 397) + '…' : text;
  return sents.slice(0, max).join(' ').trim();
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

// ── Taxonomy (always show if available) ────────────────────────

function extractTaxonomy(taxon) {
  const ancestors = taxon.ancestors;
  if (!ancestors?.length) return null;
  const family    = ancestors.find(a => a.rank === 'family');
  const subfamily = ancestors.find(a => a.rank === 'subfamily');
  if (!family) return null;
  return subfamily ? `${family.name} · ${subfamily.name}` : family.name;
}

// ── Host plants ─────────────────────────────────────────────────

function extractHostPlants(taxon, wikiExtract) {
  const fromNotes = detectHostPlants(stripHtml(taxon.taxon_notes || ''));
  if (fromNotes) return fromNotes;
  return wikiExtract ? detectHostPlants(wikiExtract) : null;
}

function detectHostPlants(text) {
  if (!text) return null;
  const m = text.match(
    /(?:larva[e]?\s+(?:feeds?|feed)\s+on|larval\s+host(?:\s+plants?)?\s*(?:include[s]?|are|:)?|host\s+plants?\s*(?:include[s]?|are|:)|feeds?\s+on)\s+([^.;]{4,150})/i
  );
  return m ? m[1].trim().replace(/[,;]\s*$/, '') : null;
}

// ── Conservation — skip LC (not useful for common moths) ────────

function getConservationStatus(taxon) {
  const s = taxon.conservation_statuses?.find(cs => {
    const code = (cs.status || '').toUpperCase();
    return code && code !== 'LC';
  });
  return s?.status_name || null;
}

// ── Render ──────────────────────────────────────────────────────

function renderNotes(notes) {
  if (!notes) return '<p class="field-notes-unavailable">Field notes unavailable.</p>';

  const parts = [];

  if (notes.description) {
    parts.push(`<p class="field-notes-desc">${escapeHTML(notes.description)}</p>`);
  }

  const rows = [];
  if (notes.taxonomy)    rows.push(fnRow('Family',       escapeHTML(notes.taxonomy)));
  if (notes.hostPlants)  rows.push(fnRow('Host Plants',  escapeHTML(notes.hostPlants)));
  if (notes.conservation) rows.push(fnRow('Status',      escapeHTML(notes.conservation)));
  if (notes.obsCount != null) rows.push(fnRow('Observations', notes.obsCount.toLocaleString() + ' worldwide'));

  if (rows.length) parts.push(`<div class="field-notes-rows">${rows.join('')}</div>`);

  return parts.length
    ? parts.join('')
    : '<p class="field-notes-unavailable">Field notes unavailable.</p>';
}

function fnRow(label, value) {
  return `<div class="field-notes-row">
    <span class="field-notes-label">${label}</span>
    <span class="field-notes-value">${value}</span>
  </div>`;
}

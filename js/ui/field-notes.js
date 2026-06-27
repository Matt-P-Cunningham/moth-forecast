import { INATURALIST_API } from '../config.js';
import { escapeHTML } from '../utils.js';

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

  const still = document.getElementById('modal-field-notes-body');
  if (!still || still.dataset.taxonId !== String(taxonId)) return;

  still.className = '';
  still.innerHTML = renderNotes(notes);

  const obsEl = document.getElementById('modal-obs-count');
  if (obsEl && notes?.obsCount != null) {
    obsEl.textContent = `${notes.obsCount.toLocaleString()} observations on iNaturalist`;
  }
}

// ── Fetch ───────────────────────────────────────────────────────

async function fetchNotes(taxonId) {
  try {
    const res = await fetch(`${INATURALIST_API}/taxa/${taxonId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const taxon = data.results?.[0];
    if (!taxon) return null;

    const taxonomy   = extractTaxonomy(taxon);
    const hostPlants = extractHostPlants(taxon);
    const obsCount   = taxon.observations_count ?? null;

    return { taxonomy, hostPlants, obsCount };
  } catch {
    return null;
  }
}

// ── Taxonomy (Order / Family / Subfamily) ───────────────────────

function extractTaxonomy(taxon) {
  const ancestors = taxon.ancestors;
  if (!ancestors?.length) return null;
  const order     = ancestors.find(a => a.rank === 'order');
  const family    = ancestors.find(a => a.rank === 'family');
  const subfamily = ancestors.find(a => a.rank === 'subfamily');
  if (!order && !family) return null;
  return {
    order:     order?.name     || null,
    family:    family?.name    || null,
    subfamily: subfamily?.name || null,
  };
}

// ── Host plants — only if specific (named genus or proper name) ──

function extractHostPlants(taxon) {
  const text = stripHtml(taxon.taxon_notes || '');
  if (!text) return null;
  const m = text.match(
    /(?:larva[e]?\s+(?:feeds?|feed)\s+on|larval\s+host(?:\s+plants?)?\s*(?:include[s]?|are|:)?|host\s+plants?\s*(?:include[s]?|are|:)|feeds?\s+on)\s+([^.;]{4,150})/i
  );
  if (!m) return null;
  const raw = m[1].trim().replace(/[,;]\s*$/, '');
  return isSpecificHostPlant(raw) ? raw : null;
}

function isSpecificHostPlant(text) {
  if (!text?.trim()) return false;
  const l = text.trim().toLowerCase();
  if (/^(plants?|trees?|shrubs?|grasses?|herbs?|conifers?|forbs?|mosses?|lichens?|flowers?|weeds?|vegetation|various|several|many|diverse|multiple|herbaceous|deciduous|woody|broad.?leaf)\b/.test(l)) return false;
  return true;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

// ── Render ──────────────────────────────────────────────────────

function renderNotes(notes) {
  if (!notes) return '';
  const rows = [];
  const t = notes.taxonomy;
  if (t) {
    if (t.order)     rows.push(fnRow('Order',     escapeHTML(t.order)));
    if (t.family)    rows.push(fnRow('Family',    escapeHTML(t.family)));
    if (t.subfamily) rows.push(fnRow('Subfamily', escapeHTML(t.subfamily)));
  }
  if (notes.hostPlants) rows.push(fnRow('Host Plants', escapeHTML(notes.hostPlants)));
  return rows.length ? `<div class="field-notes-rows">${rows.join('')}</div>` : '';
}

function fnRow(label, value) {
  return `<div class="field-notes-row">
    <span class="field-notes-label">${label}</span>
    <span class="field-notes-value">${value}</span>
  </div>`;
}

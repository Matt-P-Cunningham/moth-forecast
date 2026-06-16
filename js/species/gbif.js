import { GBIF_API } from '../config.js';
import { getMonths } from '../utils.js';

// GBIF taxon key for order Lepidoptera
const LEPIDOPTERA_KEY = 797;
// GBIF taxon keys for superfamilies to exclude (Papilionoidea = butterflies)
const BUTTERFLY_KEYS = [5473, 6953, 6954]; // Papilionidae, Pieridae, Nymphalidae superfamilies

export async function fetchGBIF(lat, lng, radiusKm) {
  try {
    const months = getMonths().split(',');
    const monthParams = months.map(m => `month=${m}`).join('&');
    // No basisOfRecord filter — include citizen science, museum specimens,
    // and literature records. Rural areas rely heavily on specimen data.
    const url = `${GBIF_API}/occurrence/search?taxonKey=${LEPIDOPTERA_KEY}` +
      `&decimalLatitude=${lat}&decimalLongitude=${lng}&radius=${radiusKm}` +
      `&${monthParams}` +
      `&facet=speciesKey&facetLimit=200&limit=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('GBIF API error');
    const data = await res.json();

    const facets = (data.facets || []).find(f => f.field === 'SPECIES_KEY');
    if (!facets || !facets.counts || !facets.counts.length) return [];

    // Fetch species details in batches of 10 (parallel)
    const counts = facets.counts.slice(0, 200);
    const BATCH = 10;
    const species = [];
    for (let i = 0; i < counts.length; i += BATCH) {
      const batch = counts.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(c => fetchGBIFSpecies(c.name, c.count)));
      species.push(...results.filter(Boolean));
    }
    return species;
  } catch(e) { return []; }
}

async function fetchGBIFSpecies(speciesKey, count) {
  try {
    const res = await fetch(`${GBIF_API}/species/${speciesKey}`);
    if (!res.ok) return null;
    const t = await res.json();

    // Skip if classified under butterfly families
    if (BUTTERFLY_KEYS.some(k => t.familyKey === k || t.orderKey === k)) return null;
    // Skip if order is not Lepidoptera
    if (t.order && t.order.toLowerCase() !== 'lepidoptera') return null;

    // Get photo if available
    let photo = null;
    try {
      const mediaRes = await fetch(`${GBIF_API}/species/${speciesKey}/media?limit=1&type=StillImage`);
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        const img = (mediaData.results || [])[0];
        if (img && img.identifier) {
          photo = {
            url: img.identifier,
            attribution: img.creator || img.rightsHolder || 'GBIF contributor',
            licenseCode: img.license ? img.license.split('/').filter(Boolean).slice(-2).join('-') : '',
            pageUrl: `https://www.gbif.org/species/${speciesKey}`
          };
        }
      }
    } catch(e) {}

    return {
      id: `gbif-${speciesKey}`,
      gbifKey: speciesKey,
      name: t.vernacularName || t.canonicalName || t.scientificName || 'Unknown moth',
      sci: t.canonicalName || t.scientificName || '',
      photo,
      count,
      source: 'gbif',
      habitatAffinity: parseGBIFHabitats(t),
      inatId: null,
    };
  } catch(e) { return null; }
}

function parseGBIFHabitats(taxon) {
  // GBIF species records sometimes include habitats from IUCN checklist
  const raw = taxon.habitats || [];
  const map = {
    'forest': 'forest', 'woodland': 'forest', 'shrubland': 'shrubland',
    'grassland': 'grassland', 'wetland': 'wetland', 'marsh': 'wetland',
    'urban': 'urban', 'artificial': 'urban', 'farmland': 'farmland',
    'agricultural': 'farmland', 'rocky': 'shrubland', 'coastal': 'coastal',
    'desert': 'shrubland', 'savanna': 'grassland',
  };
  const affinities = new Set();
  for (const h of raw) {
    const lower = (h.habitat || h).toLowerCase();
    for (const [key, val] of Object.entries(map)) {
      if (lower.includes(key)) affinities.add(val);
    }
  }
  return [...affinities];
}

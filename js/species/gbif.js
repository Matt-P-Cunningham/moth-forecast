import { GBIF_API } from '../config.js';
import { getMonths } from '../utils.js';

const LEPIDOPTERA_KEY = 797;
const BUTTERFLY_FAMILIES = new Set(['papilionidae','pieridae','nymphalidae','lycaenidae','riodinidae','hesperiidae']);

// In-memory facet cache: location key → array of {name: speciesKey, count}
let _facetCache = new Map();

export function clearGBIFCache() {
  _facetCache.clear();
}

function facetCacheKey(lat, lng, opts) {
  return opts.bbox
    ? `eco_${Math.round(opts.bbox.swlat * 10)}_${Math.round(opts.bbox.swlng * 10)}`
    : `rad_${Math.round(lat * 10)}_${Math.round(lng * 10)}`;
}

async function fetchGBIFFacets(lat, lng, opts = {}) {
  const key = facetCacheKey(lat, lng, opts);
  if (_facetCache.has(key)) return _facetCache.get(key);

  try {
    const months = getMonths().split(',');
    const monthParams = months.map(m => `month=${m}`).join('&');

    let geoParam;
    if (opts.bbox) {
      const b = opts.bbox;
      const wkt = `POLYGON((${b.swlng} ${b.swlat},${b.nelng} ${b.swlat},${b.nelng} ${b.nelat},${b.swlng} ${b.nelat},${b.swlng} ${b.swlat}))`;
      geoParam = `&geometry=${encodeURIComponent(wkt)}`;
    } else {
      geoParam = `&decimalLatitude=${lat}&decimalLongitude=${lng}&radius=${opts.radiusKm ?? 100}`;
    }

    const url = `${GBIF_API}/occurrence/search?taxonKey=${LEPIDOPTERA_KEY}` +
      geoParam + `&${monthParams}` +
      `&facet=speciesKey&facetLimit=500&limit=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('GBIF facet error');
    const data = await res.json();

    const facets = (data.facets || []).find(f => f.field === 'SPECIES_KEY');
    const counts = facets?.counts || [];
    _facetCache.set(key, counts);
    return counts;
  } catch(e) {
    _facetCache.set(key, []);
    return [];
  }
}

export async function fetchGBIFPage(lat, lng, opts = {}, page = 1, perPage = 25) {
  try {
    const allFacets = await fetchGBIFFacets(lat, lng, opts);
    const start = (page - 1) * perPage;
    const slice = allFacets.slice(start, start + perPage);

    if (!slice.length) return { species: [], total: allFacets.length, hasMore: false };

    const BATCH = 5;
    const species = [];
    for (let i = 0; i < slice.length; i += BATCH) {
      const batch = slice.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(c => fetchGBIFSpecies(c.name, c.count)));
      species.push(...results.filter(Boolean));
    }

    return {
      species,
      total: allFacets.length,
      hasMore: start + perPage < allFacets.length,
    };
  } catch(e) {
    return { species: [], total: 0, hasMore: false };
  }
}

async function fetchGBIFSpecies(speciesKey, count) {
  try {
    const res = await fetch(`${GBIF_API}/species/${speciesKey}`);
    if (!res.ok) return null;
    const t = await res.json();

    if (t.family && BUTTERFLY_FAMILIES.has(t.family.toLowerCase())) return null;
    if (t.vernacularName && t.vernacularName.toLowerCase().includes('butterfly')) return null;
    if (t.order && t.order.toLowerCase() !== 'lepidoptera') return null;

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

export async function fetchGBIFPhoto(gbifKey) {
  try {
    const res = await fetch(`${GBIF_API}/species/${gbifKey}/media?limit=1&type=StillImage`);
    if (!res.ok) return null;
    const data = await res.json();
    const img = (data.results || [])[0];
    if (!img || !img.identifier) return null;
    return {
      url: img.identifier,
      attribution: img.creator || img.rightsHolder || 'GBIF contributor',
      licenseCode: img.license ? img.license.split('/').filter(Boolean).slice(-2).join('-') : '',
      pageUrl: `https://www.gbif.org/species/${gbifKey}`,
    };
  } catch(e) { return null; }
}

function parseGBIFHabitats(taxon) {
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

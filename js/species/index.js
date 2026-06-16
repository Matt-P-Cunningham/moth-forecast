import { fetchINat } from './inaturalist.js';
import { fetchGBIF } from './gbif.js';

export async function fetchAllSpecies(lat, lng, radiusKm) {
  const [inatResults, gbifResults] = await Promise.all([
    fetchINat(lat, lng, radiusKm),
    fetchGBIF(lat, lng, radiusKm),
  ]);

  if (!inatResults) return null;

  // Build lookup by scientific name from iNat (primary source)
  const byName = new Map();
  for (const m of inatResults) {
    byName.set(normalizeKey(m.sci), m);
  }

  // Merge GBIF results: enrich iNat records with GBIF habitat data,
  // or append GBIF-only species not found in iNat
  for (const g of gbifResults) {
    const key = normalizeKey(g.sci);
    if (byName.has(key)) {
      // Enrich existing iNat record with GBIF habitat affinities
      const existing = byName.get(key);
      existing.gbifKey = g.gbifKey;
      if (g.habitatAffinity.length && !existing.habitatAffinity.length) {
        existing.habitatAffinity = g.habitatAffinity;
      }
    } else {
      // Add as GBIF-only species
      byName.set(key, g);
    }
  }

  return [...byName.values()];
}

function normalizeKey(name) {
  return (name || '').toLowerCase().trim();
}

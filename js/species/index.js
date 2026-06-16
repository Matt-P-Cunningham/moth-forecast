import { fetchINat } from './inaturalist.js';
import { fetchGBIF } from './gbif.js';

export async function fetchAllSpecies(lat, lng, radiusKm) {
  const [inatResults, gbifResults] = await Promise.all([
    fetchINat(lat, lng, radiusKm),
    fetchGBIF(lat, lng, radiusKm),
  ]);

  // Both failed
  if (!inatResults && !gbifResults.length) return null;

  const byName = new Map();

  // Index iNat results (may be null if fetch failed)
  for (const m of (inatResults || [])) {
    byName.set(normalizeKey(m.sci), { ...m, inatCount: m.count });
  }

  // Merge GBIF as an equal peer — combine counts and enrich metadata
  for (const g of gbifResults) {
    const key = normalizeKey(g.sci);
    if (byName.has(key)) {
      const existing = byName.get(key);
      existing.gbifKey = g.gbifKey;
      // Combined count: sum of distinct records from each source
      existing.inatCount = existing.inatCount ?? existing.count;
      existing.gbifCount = g.count;
      existing.count = (existing.inatCount || 0) + (existing.gbifCount || 0);
      existing.source = 'both';
      if (g.habitatAffinity.length && !existing.habitatAffinity.length) {
        existing.habitatAffinity = g.habitatAffinity;
      }
      // Prefer iNat photo but fall back to GBIF photo if iNat has none
      if (!existing.photo && g.photo) existing.photo = g.photo;
    } else {
      byName.set(key, { ...g, gbifCount: g.count });
    }
  }

  return [...byName.values()];
}

function normalizeKey(name) {
  return (name || '').toLowerCase().trim();
}

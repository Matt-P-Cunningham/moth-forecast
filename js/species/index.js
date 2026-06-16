import { fetchINat } from './inaturalist.js';
import { fetchGBIF } from './gbif.js';

// opts: { bbox, radiusKm }
// bbox comes from the selected ecoregion (US only); radiusKm is the non-US fallback
export async function fetchAllSpecies(lat, lng, opts = {}) {
  const [inatResults, gbifResults] = await Promise.all([
    fetchINat(lat, lng, opts),
    fetchGBIF(lat, lng, opts),
  ]);

  if (!inatResults && !gbifResults.length) return null;

  const byName = new Map();

  for (const m of (inatResults || [])) {
    byName.set(normalizeKey(m.sci), { ...m, inatCount: m.count });
  }

  for (const g of gbifResults) {
    const key = normalizeKey(g.sci);
    if (byName.has(key)) {
      const existing = byName.get(key);
      existing.gbifKey = g.gbifKey;
      existing.inatCount = existing.inatCount ?? existing.count;
      existing.gbifCount = g.count;
      existing.count = (existing.inatCount || 0) + (existing.gbifCount || 0);
      existing.source = 'both';
      if (g.habitatAffinity.length && !existing.habitatAffinity.length) {
        existing.habitatAffinity = g.habitatAffinity;
      }
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

import { fetchINat } from './inaturalist.js';
import { fetchGBIFPage, clearGBIFCache } from './gbif.js';

export const SPECIES_PER_PAGE = 25;

export function resetSpeciesPagination() {
  clearGBIFCache();
}

export { clearGBIFCache } from './gbif.js';

export async function fetchSpeciesPage(lat, lng, opts = {}, page = 1) {
  const [inat, gbif] = await Promise.all([
    fetchINat(lat, lng, opts, page, SPECIES_PER_PAGE),
    fetchGBIFPage(lat, lng, opts, page, SPECIES_PER_PAGE),
  ]);

  const byName = new Map();

  for (const m of (inat.species || [])) {
    byName.set(normalizeKey(m.sci), { ...m, inatCount: m.count });
  }

  for (const g of (gbif.species || [])) {
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

  const hasMore = inat.hasMore || gbif.hasMore;
  const total = inat.total > 0 ? inat.total : (gbif.total > 0 ? gbif.total : null);

  return {
    species: [...byName.values()],
    total,
    hasMore,
  };
}

function normalizeKey(name) {
  return (name || '').toLowerCase().trim();
}

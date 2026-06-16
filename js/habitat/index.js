import { fetchOSMHabitat } from './osm.js';
import { fetchSentinelIndices } from './sentinel.js';

export async function fetchHabitat(lat, lng, radiusKm) {
  const radiusM = Math.min(radiusKm * 1000, 5000); // cap OSM query at 5km
  const [osmResult, sentinelResult] = await Promise.all([
    fetchOSMHabitat(lat, lng, radiusM),
    fetchSentinelIndices(lat, lng, Math.min(radiusM, 2000)),
  ]);

  if (!osmResult && !sentinelResult) return null;

  // Sentinel enriches OSM: if both available, merge types with Sentinel having higher weight
  if (osmResult && sentinelResult) {
    const merged = { ...osmResult.types };
    for (const [k, v] of Object.entries(sentinelResult.types)) {
      merged[k] = (merged[k] || 0) * 0.4 + v * 0.6;
    }
    const total = Object.values(merged).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(merged)) merged[k] /= total;
    const primary = Object.entries(merged).sort((a, b) => b[1] - a[1])[0][0];
    return { ...osmResult, types: merged, primary, source: 'osm+sentinel',
      ndvi: sentinelResult.ndvi, ndwi: sentinelResult.ndwi };
  }

  return osmResult || sentinelResult;
}

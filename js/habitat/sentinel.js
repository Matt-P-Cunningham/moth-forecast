import { SENTINEL_PROXY } from '../config.js';

// Sentinel Hub integration requires a server-side proxy that holds OAuth2 credentials.
// Set SENTINEL_PROXY in config.js to your proxy URL to enable.
// The proxy should accept: POST /sentinel-stats { lat, lng, radiusM }
// and return: { ndvi: number, ndwi: number, ndbi: number }

export async function fetchSentinelIndices(lat, lng, radiusM = 2000) {
  if (!SENTINEL_PROXY) return null;
  try {
    const res = await fetch(SENTINEL_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, radiusM }),
    });
    if (!res.ok) throw new Error('Sentinel proxy error');
    const { ndvi, ndwi, ndbi } = await res.json();
    return classifySentinel(ndvi, ndwi, ndbi);
  } catch(e) { return null; }
}

function classifySentinel(ndvi, ndwi, ndbi) {
  const types = {};
  if (ndvi > 0.5) types.forest = ndvi - 0.3;
  else if (ndvi > 0.2) types.grassland = ndvi;
  if (ndwi > 0.1) types.wetland = ndwi;
  if (ndbi > 0.1) types.urban = ndbi;
  if (!Object.keys(types).length) types.shrubland = 0.5;

  const total = Object.values(types).reduce((a, b) => a + b, 0);
  const normalized = {};
  for (const [k, v] of Object.entries(types)) normalized[k] = v / total;

  const primary = Object.entries(normalized).sort((a, b) => b[1] - a[1])[0][0];
  return { primary, types: normalized, source: 'sentinel', ndvi, ndwi, ndbi };
}

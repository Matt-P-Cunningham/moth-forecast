const EPA_LAYER = 'https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/11';
// 0.05° ≈ 5km simplification — keeps polygons to ~150-400 vertices for Leaflet
const SIMPLIFY = '0.05';

export async function fetchEcoregionAtPoint(lat, lng) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'US_L3CODE,US_L3NAME,NA_L2NAME,NA_L1NAME',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: SIMPLIFY,
    f: 'geojson',
  });
  try {
    const res = await fetch(`${EPA_LAYER}/query?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const feat = (data.features || [])[0];
    if (!feat) return null;
    return featureToEco(feat);
  } catch(e) { return null; }
}

export async function fetchNeighboringEcoregions(bbox, excludeCode) {
  const geom = JSON.stringify({
    xmin: bbox.swlng, ymin: bbox.swlat,
    xmax: bbox.nelng, ymax: bbox.nelat,
  });
  const params = new URLSearchParams({
    geometry: geom,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'US_L3CODE,US_L3NAME,NA_L2NAME,NA_L1NAME',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: SIMPLIFY,
    f: 'geojson',
  });
  try {
    const res = await fetch(`${EPA_LAYER}/query?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || [])
      .filter(f => f.properties.US_L3CODE !== excludeCode)
      .map(featureToEco);
  } catch(e) { return []; }
}

function featureToEco(feat) {
  const p = feat.properties;
  return {
    code: p.US_L3CODE,
    name: p.US_L3NAME,
    l2name: p.NA_L2NAME,
    l1name: p.NA_L1NAME,
    bbox: computeBbox(feat.geometry),
    feature: feat,
  };
}

function computeBbox(geometry) {
  const pts = [];
  function walk(c) {
    if (typeof c[0] === 'number') pts.push(c);
    else c.forEach(walk);
  }
  walk(geometry.coordinates);
  return {
    swlat: Math.min(...pts.map(p => p[1])),
    swlng: Math.min(...pts.map(p => p[0])),
    nelat: Math.max(...pts.map(p => p[1])),
    nelng: Math.max(...pts.map(p => p[0])),
  };
}

export function bboxToWKT({ swlng, swlat, nelng, nelat }) {
  return `POLYGON((${swlng} ${swlat},${nelng} ${swlat},${nelng} ${nelat},${swlng} ${nelat},${swlng} ${swlat}))`;
}

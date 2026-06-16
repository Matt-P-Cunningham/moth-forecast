import { OVERPASS_API } from '../config.js';

const LANDUSE_MAP = {
  forest: 'forest', wood: 'forest',
  farmland: 'farmland', farmyard: 'farmland', orchard: 'farmland', vineyard: 'farmland',
  meadow: 'grassland', grass: 'grassland',
  residential: 'urban', industrial: 'urban', commercial: 'urban', retail: 'urban',
  cemetery: 'urban', allotments: 'urban',
  wetland: 'wetland', marsh: 'wetland', swamp: 'wetland',
};

const NATURAL_MAP = {
  wood: 'forest', scrub: 'shrubland', heath: 'shrubland',
  wetland: 'wetland', water: 'water', bay: 'water', coastline: 'coastal',
  beach: 'coastal', sand: 'coastal',
  grassland: 'grassland', fell: 'grassland',
  bare_rock: 'shrubland', cliff: 'shrubland', scree: 'shrubland',
};

const HABITAT_LABELS = {
  forest: 'Forest / Woodland',
  farmland: 'Agricultural / Farmland',
  grassland: 'Grassland / Meadow',
  urban: 'Urban / Suburban',
  wetland: 'Wetland / Marsh',
  water: 'Open Water',
  shrubland: 'Shrubland / Heath',
  coastal: 'Coastal',
};

export async function fetchOSMHabitat(lat, lng, radiusM = 3000) {
  const query = `[out:json][timeout:20];
(
  way["landuse"~"^(${Object.keys(LANDUSE_MAP).join('|')})$"](around:${radiusM},${lat},${lng});
  way["natural"~"^(${Object.keys(NATURAL_MAP).join('|')})$"](around:${radiusM},${lat},${lng});
  relation["natural"~"^(wood|wetland|water)$"](around:${radiusM},${lat},${lng});
);
out tags;`;

  try {
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!res.ok) throw new Error('Overpass error');
    const data = await res.json();
    return classifyHabitat(data.elements || []);
  } catch(e) { return null; }
}

function classifyHabitat(elements) {
  const scores = {};
  for (const el of elements) {
    const tags = el.tags || {};
    const lu = tags.landuse ? LANDUSE_MAP[tags.landuse] : null;
    const nat = tags.natural ? NATURAL_MAP[tags.natural] : null;
    const type = lu || nat;
    if (type) scores[type] = (scores[type] || 0) + 1;
  }

  if (!Object.keys(scores).length) return null;

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const normalized = {};
  for (const [k, v] of Object.entries(scores)) normalized[k] = v / total;

  const sorted = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];

  return {
    primary,
    types: normalized,
    source: 'osm',
    label: HABITAT_LABELS[primary] || primary,
    description: buildDescription(sorted),
  };
}

function buildDescription(sorted) {
  const top = sorted.slice(0, 3).filter(([, v]) => v > 0.05);
  if (top.length === 1) return `Predominantly ${HABITAT_LABELS[top[0][0]] || top[0][0]}`;
  const parts = top.map(([k, v]) => `${HABITAT_LABELS[k] || k} (${Math.round(v * 100)}%)`);
  return parts.join(' · ');
}

import { INATURALIST_API, GBIF_API } from '../config.js';

const ALLOWED = new Set(['cc0','cc-by','cc-by-nc','cc-by-sa','cc-by-nc-sa','cc-by-nd','cc-by-nc-nd']);
const LARVAL_RE = /larva|caterpillar|larval|instar|larvae/i;
const PHOTO_CACHE = new Map(); // session-only, keyed by taxonId|gbifKey|sciName

const LICENSE_DISPLAY = {
  'cc0': 'CC0', 'cc-by': 'CC BY', 'cc-by-nc': 'CC BY-NC',
  'cc-by-sa': 'CC BY-SA', 'cc-by-nd': 'CC BY-ND',
  'cc-by-nc-sa': 'CC BY-NC-SA', 'cc-by-nc-nd': 'CC BY-NC-ND',
};

// ── Public API ──────────────────────────────────────────────────

export async function fetchAllPhotos(taxonId, gbifKey, sciName) {
  const cacheKey = `${taxonId}|${gbifKey}|${sciName}`;
  if (PHOTO_CACHE.has(cacheKey)) return PHOTO_CACHE.get(cacheKey);

  const [r1, r2, r3, r4] = await Promise.allSettled([
    taxonId ? fetchInatPhotos(taxonId) : Promise.resolve([]),
    gbifKey  ? fetchGbifPhotos(gbifKey) : Promise.resolve([]),
    sciName  ? fetchEolPhotos(sciName) : Promise.resolve([]),
    sciName  ? fetchWikiPhotos(sciName) : Promise.resolve([]),
  ]);

  const all = deduplicate([
    ...(r1.status === 'fulfilled' ? r1.value : []),
    ...(r2.status === 'fulfilled' ? r2.value : []),
    ...(r3.status === 'fulfilled' ? r3.value : []),
    ...(r4.status === 'fulfilled' ? r4.value : []),
  ]);

  const photoSet = assignSlots(all);
  PHOTO_CACHE.set(cacheKey, photoSet);
  return photoSet;
}

export function licenseDisplay(normalized) {
  return LICENSE_DISPLAY[normalized] || (normalized || '').toUpperCase();
}

// ── Source 1 — iNaturalist ──────────────────────────────────────

async function fetchInatPhotos(taxonId) {
  const photos = [];

  // Curated taxon photo library
  try {
    const res = await fetch(`${INATURALIST_API}/taxa/${taxonId}?photos=true`);
    if (res.ok) {
      const data = await res.json();
      const taxon = data.results?.[0];
      for (const tp of taxon?.taxon_photos || []) {
        const p = tp.photo;
        if (!p || p.flags?.length) continue;
        const lic = normalizeLicense(p.license_code);
        if (!lic) continue;
        photos.push({
          url: p.medium_url || inatSize(p.url, 'medium'),
          squareUrl: p.url,
          license: lic,
          attribution: cleanAttr(p.attribution),
          source: 'iNaturalist',
          type: 'adult',
          priority: 1,
        });
      }
    }
  } catch { /* non-fatal */ }

  // Research-grade observations filtered to Larva life stage (term_id=1, term_value_id=6)
  try {
    const res = await fetch(
      `${INATURALIST_API}/observations?taxon_id=${taxonId}` +
      `&quality_grade=research&photos=true&per_page=20&term_id=1&term_value_id=6`
    );
    if (res.ok) {
      const data = await res.json();
      for (const obs of data.results || []) {
        for (const p of obs.photos || []) {
          const lic = normalizeLicense(p.license_code);
          if (!lic) continue;
          photos.push({
            url: inatSize(p.url, 'medium'),
            squareUrl: p.url,
            license: lic,
            attribution: cleanAttr(p.attribution),
            source: 'iNaturalist',
            type: 'caterpillar',
            priority: 1,
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  // Research-grade observations filtered to Adult life stage (term_id=1, term_value_id=4)
  try {
    const res = await fetch(
      `${INATURALIST_API}/observations?taxon_id=${taxonId}` +
      `&quality_grade=research&photos=true&per_page=10&term_id=1&term_value_id=4`
    );
    if (res.ok) {
      const data = await res.json();
      for (const obs of data.results || []) {
        for (const p of obs.photos || []) {
          const lic = normalizeLicense(p.license_code);
          if (!lic) continue;
          photos.push({
            url: inatSize(p.url, 'medium'),
            squareUrl: p.url,
            license: lic,
            attribution: cleanAttr(p.attribution),
            source: 'iNaturalist',
            type: 'adult',
            priority: 1,
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  return photos;
}

function inatSize(url, size) {
  if (!url) return url;
  return url.replace(/\/(square|small|medium|large|original)\./, `/${size}.`);
}

// ── Source 2 — GBIF ────────────────────────────────────────────

async function fetchGbifPhotos(gbifKey) {
  const photos = [];

  try {
    const res = await fetch(`${GBIF_API}/species/${gbifKey}/media?limit=20`);
    if (res.ok) {
      const data = await res.json();
      for (const item of data.results || []) {
        if (item.type !== 'StillImage') continue;
        if (!item.identifier) continue;
        const lic = normalizeLicense(item.license);
        if (!lic) continue;
        const desc = `${item.description || ''} ${item.title || ''}`;
        photos.push({
          url: item.identifier,
          squareUrl: item.identifier,
          license: lic,
          attribution: item.rightsHolder || item.creator || '',
          source: 'GBIF',
          type: LARVAL_RE.test(desc) ? 'caterpillar' : 'adult',
          priority: 2,
        });
      }
    }
  } catch { /* non-fatal */ }

  // Occurrence search specifically for larval life stage
  try {
    const res = await fetch(
      `${GBIF_API}/occurrence/search?taxonKey=${gbifKey}` +
      `&mediaType=StillImage&lifeStage=Larva&limit=5`
    );
    if (res.ok) {
      const data = await res.json();
      for (const occ of data.results || []) {
        for (const med of occ.media || []) {
          if (!med.identifier) continue;
          const lic = normalizeLicense(med.license);
          if (!lic) continue;
          photos.push({
            url: med.identifier,
            squareUrl: med.identifier,
            license: lic,
            attribution: med.rightsHolder || '',
            source: 'GBIF',
            type: 'caterpillar',
            priority: 2,
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  return photos;
}

// ── Source 3 — Encyclopedia of Life ────────────────────────────

async function fetchEolPhotos(sciName) {
  const photos = [];
  try {
    const searchRes = await fetch(
      `https://eol.org/api/search/1.0.json?q=${encodeURIComponent(sciName)}&exact=true&page=1`
    );
    if (!searchRes.ok) return photos;
    const searchData = await searchRes.json();
    const eolId = searchData.results?.[0]?.id;
    if (!eolId) return photos;

    const pageRes = await fetch(
      `https://eol.org/api/pages/1.0/${eolId}.json` +
      `?images_per_page=8&videos_per_page=0&sounds_per_page=0&maps_per_page=0&texts_per_page=0&details=true`
    );
    if (!pageRes.ok) return photos;
    const pageData = await pageRes.json();

    for (const obj of pageData.dataObjects || []) {
      const mediaType = obj.dataType || obj.mediaType || '';
      if (!mediaType.includes('StillImage') && !mediaType.includes('image')) continue;
      const url = obj.eolMediaURL || obj.mediaURL;
      if (!url) continue;
      const lic = normalizeLicense(obj.license);
      if (!lic) continue;
      const desc = `${obj.description || ''} ${obj.title || ''}`;
      photos.push({
        url,
        squareUrl: obj.eolThumbnailURL || url,
        license: lic,
        attribution: obj.rightsHolder || obj.agents?.[0]?.full_name || '',
        source: 'EOL',
        type: LARVAL_RE.test(desc) ? 'caterpillar' : 'adult',
        priority: 3,
      });
    }
  } catch { /* non-fatal */ }
  return photos;
}

// ── Source 4 — Wikimedia Commons ───────────────────────────────

async function fetchWikiPhotos(sciName) {
  const photos = [];
  try {
    // Step 1: get images listed on the Wikipedia page for this species
    const pageRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(sciName)}&prop=images&imlimit=10` +
      `&format=json&origin=*`
    );
    if (!pageRes.ok) return photos;
    const pageData = await pageRes.json();
    const pages = Object.values(pageData.query?.pages || {});
    if (!pages.length || pages[0].missing !== undefined) return photos;

    const imageTitles = (pages[0].images || [])
      .map(i => i.title)
      .filter(t => /\.(jpg|jpeg|png)$/i.test(t))
      .slice(0, 8);

    if (!imageTitles.length) return photos;

    // Step 2: batch-fetch license + URL info for all image titles at once
    const infoRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${imageTitles.map(encodeURIComponent).join('|')}` +
      `&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`
    );
    if (!infoRes.ok) return photos;
    const infoData = await infoRes.json();

    for (const page of Object.values(infoData.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      const meta = info.extmetadata || {};
      const rawLic = meta.License?.value || meta.LicenseShortName?.value || '';
      const lic = normalizeLicense(rawLic);
      if (!lic) continue;
      const artist = stripHtml(meta.Artist?.value || '');
      const titleLower = (page.title || '').toLowerCase();
      photos.push({
        url: info.url,
        squareUrl: info.url,
        license: lic,
        attribution: artist,
        source: 'Wikimedia',
        type: LARVAL_RE.test(titleLower) ? 'caterpillar' : 'adult',
        priority: 4,
      });
    }
  } catch { /* non-fatal */ }
  return photos;
}

// ── License normalization ───────────────────────────────────────
// Most specific patterns checked first to avoid substring collisions
// (e.g., "by-nc" must be checked before "/by/" or it would misfire)

function normalizeLicense(license) {
  if (!license) return null;
  const l = license.toLowerCase().trim();
  if (!l) return null;
  if (ALLOWED.has(l)) return l;
  if (l.includes('by-nc-sa') || l.includes('by/nc/sa')) return 'cc-by-nc-sa';
  if (l.includes('by-nc-nd') || l.includes('by/nc/nd')) return 'cc-by-nc-nd';
  if (l.includes('by-nc')    || l.includes('by/nc/'))   return 'cc-by-nc';
  if (l.includes('by-sa')    || l.includes('by/sa/'))   return 'cc-by-sa';
  if (l.includes('by-nd')    || l.includes('by/nd/'))   return 'cc-by-nd';
  if (l.includes('cc0') || l.includes('publicdomain') || l.includes('public domain') ||
      l.includes('/zero/') || l === 'pdm') return 'cc0';
  // Plain CC BY — must not be a nc/sa/nd variant
  if ((l === 'cc-by' || l === 'cc by' || l.includes('/by/')) &&
      !l.includes('nc') && !l.includes('sa') && !l.includes('nd')) return 'cc-by';
  return null;
}

// ── Dedup + slot assignment ─────────────────────────────────────

function deduplicate(photos) {
  const seen = new Set();
  return photos.filter(p => {
    if (!p.url) return false;
    const key = p.url.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assignSlots(photos) {
  const adults = photos.filter(p => p.type === 'adult').sort((a, b) => a.priority - b.priority);
  const cats   = photos.filter(p => p.type === 'caterpillar').sort((a, b) => a.priority - b.priority);
  const adult = adults[0] || null;
  const caterpillar = cats[0] || null;
  const usedUrls = new Set([adult?.url, caterpillar?.url].filter(Boolean));
  const additional = photos
    .filter(p => !usedUrls.has(p.url))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
  return { adult, caterpillar, additional };
}

// ── Utilities ───────────────────────────────────────────────────

// iNat attributions look like "(c) John Doe, some rights reserved (CC BY-NC)"
function cleanAttr(str) {
  if (!str) return '';
  return str
    .replace(/,?\s*(?:some|all)\s+rights\s+reserved[^,.]*/i, '')
    .replace(/^\s*\(c\)\s*/i, '')
    .trim();
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

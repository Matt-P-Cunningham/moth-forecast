import { INATURALIST_API, MOTH_TAXON_ID, BUTTERFLY_TAXON_ID } from '../config.js';
import { getMonths } from '../utils.js';

export async function fetchINat(lat, lng, { bbox, radiusKm = 100 } = {}, page = 1, perPage = 25) {
  try {
    let geoParams;
    if (bbox) {
      geoParams = `&swlat=${bbox.swlat}&swlng=${bbox.swlng}&nelat=${bbox.nelat}&nelng=${bbox.nelng}`;
    } else {
      geoParams = `&lat=${lat}&lng=${lng}&radius=${radiusKm}`;
    }

    const url = `${INATURALIST_API}/observations/species_counts` +
      `?taxon_id=${MOTH_TAXON_ID}&without_taxon_id=${BUTTERFLY_TAXON_ID}` +
      geoParams +
      `&month=${getMonths()}&quality_grade=research,needs_id` +
      `&per_page=${perPage}&page=${page}&order=desc&order_by=observations_count`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('iNat API error');
    const data = await res.json();
    const total = data.total_results ?? 0;
    const species = (data.results || []).map(r => {
      const taxon = r.taxon || {};
      const p = taxon.default_photo || null;
      return {
        id: taxon.id,
        name: taxon.preferred_common_name || taxon.name || 'Unknown moth',
        sci: taxon.name || '',
        photo: p ? {
          url: p.medium_url || p.url || p.square_url || null,
          attribution: p.attribution || '',
          licenseCode: p.license_code || '',
          pageUrl: `https://www.inaturalist.org/taxa/${taxon.id}`
        } : null,
        count: Number(r.count || 0),
        source: 'inat',
        habitatAffinity: [],
      };
    }).filter(m => m.id);

    return { species, total, hasMore: page * perPage < total };
  } catch(e) {
    return { species: [], total: 0, hasMore: false };
  }
}

export async function fetchInatTaxonPhotos(taxonId) {
  try {
    const res = await fetch(`${INATURALIST_API}/taxa/${taxonId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const taxon = (data.results || [])[0];
    if (!taxon) return [];
    return (taxon.taxon_photos || [])
      .slice(0, 4)
      .map(tp => {
        const p = tp.photo || {};
        return {
          url: p.medium_url || p.url || p.square_url || null,
          squareUrl: p.square_url || p.medium_url || null,
          attribution: p.attribution || '',
          licenseCode: p.license_code || '',
          pageUrl: `https://www.inaturalist.org/taxa/${taxonId}`,
        };
      })
      .filter(p => p.url);
  } catch(e) { return []; }
}

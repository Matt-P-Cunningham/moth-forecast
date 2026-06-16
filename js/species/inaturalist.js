import { INATURALIST_API, MOTH_TAXON_ID, BUTTERFLY_TAXON_ID } from '../config.js';
import { getMonths } from '../utils.js';

export async function fetchINat(lat, lng, radiusKm) {
  try {
    const url = `${INATURALIST_API}/observations/species_counts` +
      `?taxon_id=${MOTH_TAXON_ID}&without_taxon_id=${BUTTERFLY_TAXON_ID}` +
      `&lat=${lat}&lng=${lng}&radius=${radiusKm}` +
      `&month=${getMonths()}&quality_grade=research` +
      `&per_page=60&order=desc&order_by=observations_count`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('iNat API error');
    const data = await res.json();
    return (data.results || []).map(r => {
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
  } catch(e) { return null; }
}

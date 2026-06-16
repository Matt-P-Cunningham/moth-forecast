export const MOTH_TAXON_ID = 47157;
export const BUTTERFLY_TAXON_ID = 47224;
export const WINDOW_DAYS = 14;
export const FORECAST_DAYS = 3;
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const INATURALIST_API = 'https://api.inaturalist.org/v1';
export const GBIF_API = 'https://api.gbif.org/v1';
export const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
export const NOMINATIM_API = 'https://nominatim.openstreetmap.org';
export const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Sentinel Hub — requires OAuth2 client credentials served from a proxy.
// Set SENTINEL_PROXY to your proxy URL to enable satellite habitat enrichment.
// If null, Overpass (OSM) is the sole habitat source.
export const SENTINEL_PROXY = null;

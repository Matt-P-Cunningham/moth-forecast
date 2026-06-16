// Static habitat affinity lookup by genus and family.
// Used as a fallback when GBIF doesn't provide habitat data.
// Keys are lowercase genus or family names; values are arrays of habitat types.

export const GENUS_AFFINITIES = {
  // Forest specialists
  catocala: ['forest'],
  panthea: ['forest'],
  acronicta: ['forest'],
  lithophane: ['forest'],
  xestia: ['forest', 'grassland'],
  epirrita: ['forest'],
  operophtera: ['forest'],
  rheumaptera: ['forest'],
  hydriomena: ['forest', 'wetland'],
  eupithecia: ['forest', 'grassland'],

  // Wetland / marsh
  simyra: ['wetland'],
  archanara: ['wetland'],
  arenostola: ['wetland'],
  leucania: ['wetland', 'grassland'],
  mythimna: ['wetland', 'grassland'],
  nonagria: ['wetland'],
  phragmatiphila: ['wetland'],

  // Grassland / open
  agrotis: ['grassland', 'farmland'],
  euxoa: ['grassland', 'farmland'],
  apamea: ['grassland'],
  oligia: ['grassland'],
  chortodes: ['grassland', 'wetland'],
  lacanobia: ['grassland', 'farmland'],

  // Shrubland / heathland
  saturnia: ['shrubland', 'forest'],
  lasiocampa: ['shrubland'],
  macrothylacia: ['shrubland', 'grassland'],
  calliteara: ['forest', 'shrubland'],

  // Urban / generalist
  noctua: ['urban', 'grassland', 'farmland'],
  phlogophora: ['urban', 'farmland'],
  autographa: ['urban', 'farmland'],
  plusia: ['farmland', 'urban'],
  spodoptera: ['farmland', 'urban'],
  helicoverpa: ['farmland'],
  heliothis: ['farmland'],

  // Coastal
  eremobia: ['coastal', 'grassland'],
  photedes: ['wetland', 'coastal'],
  chilodes: ['wetland', 'coastal'],
};

export const FAMILY_AFFINITIES = {
  sphingidae: ['forest', 'shrubland'],
  saturniidae: ['forest', 'shrubland'],
  lasiocampidae: ['forest', 'shrubland'],
  geometridae: ['forest', 'shrubland'],
  notodontidae: ['forest'],
  lymantriidae: ['forest'],
  noctuidae: ['grassland', 'farmland'],
  erebidae: ['forest', 'grassland'],
  arctiidae: ['grassland', 'shrubland'],
  tortricidae: ['forest', 'shrubland'],
  pyralidae: ['farmland', 'urban'],
  crambidae: ['grassland', 'wetland'],
  pterophoridae: ['grassland', 'coastal'],
};

export function lookupAffinity(moth) {
  if (moth.habitatAffinity && moth.habitatAffinity.length) return moth.habitatAffinity;
  const genus = (moth.sci || '').split(' ')[0].toLowerCase();
  if (GENUS_AFFINITIES[genus]) return GENUS_AFFINITIES[genus];
  // Family lookup requires taxon family data — enrich via GBIF if available
  return [];
}

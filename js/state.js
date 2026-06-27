export const state = {
  allMoths: [],
  forecastHours: [],
  selectedIndex: 0,
  nowIndex: 0,
  peakIndex: 0,
  currentLat: null,
  currentLng: null,
  currentName: '',
  currentView: 'grid',
  habitat: null,
  // ecoregion: { code, name, l2name, l1name, bbox, feature } | null
  // null = non-US location, falls back to 100km radius
  ecoregion: null,
  // Species pagination
  speciesPage: 0,
  speciesTotalAPI: null,
  speciesAllLoaded: false,
};

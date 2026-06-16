const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const CYCLE = 29.53059;

export function getMoonPhase(date) {
  date = date || new Date();
  const diff = (date - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const phase = ((diff % CYCLE) + CYCLE) % CYCLE;
  const fraction = phase / CYCLE;
  const illum = Math.round((1 - Math.cos(2 * Math.PI * fraction)) / 2 * 100);
  let name;
  if (phase < 1.85) name = 'New Moon';
  else if (phase < 7.38) name = 'Waxing Crescent';
  else if (phase < 9.22) name = 'First Quarter';
  else if (phase < 14.77) name = 'Waxing Gibbous';
  else if (phase < 16.61) name = 'Full Moon';
  else if (phase < 22.15) name = 'Waning Gibbous';
  else if (phase < 23.99) name = 'Last Quarter';
  else name = 'Waning Crescent';
  return { phase, fraction, illum, name, darkScore: Math.round((1 - illum / 100) * 100) };
}

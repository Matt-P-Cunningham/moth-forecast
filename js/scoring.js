export function calcNightScore(w, moon) {
  if (!w || !moon) return { score: 50, label: 'Unknown', desc: 'Forecast data unavailable', level: 'fair' };

  if (w.isDay) {
    return { score: 0, label: 'Daytime', desc: 'Most moths stay hidden until dusk', level: 'day' };
  }

  let score = 0;

  if (w.temp >= 65 && w.temp <= 80) score += 35;
  else if (w.temp >= 55 && w.temp < 65) score += 25;
  else if (w.temp >= 50 && w.temp < 55) score += 12;
  else if (w.temp < 50) score += 0;
  else score += 20;

  if (w.wind < 5) score += 25;
  else if (w.wind < 10) score += 18;
  else if (w.wind < 15) score += 10;

  score += Math.round(moon.darkScore * 0.25);

  if (w.precip > 0) score = Math.round(score * 0.3);
  if (w.clouds > 80 && w.precip === 0) score = Math.round(score * 0.85);

  score = Math.min(100, Math.max(0, score));

  let label, desc, level;
  if (w.precip > 0) { label = 'Poor — rain expected'; desc = 'Moths shelter during rain'; level = 'poor'; }
  else if (score >= 80) { label = 'Excellent conditions'; desc = 'Warm, calm & dark — ideal for moths'; level = 'good'; }
  else if (score >= 60) { label = 'Good conditions'; desc = 'Favorable for moth activity'; level = 'good'; }
  else if (score >= 40) { label = 'Fair conditions'; desc = 'Some moths may be active'; level = 'fair'; }
  else { label = 'Poor conditions'; desc = w.temp < 50 ? 'Too cold for most species' : 'Unfavorable for moth activity'; level = 'poor'; }
  return { score, label, desc, level };
}

export function calcMothScore(moth, nightScore) {
  const commonScore = Math.min(100, Math.round(Math.log10(moth.count + 1) * 40));
  return Math.round((commonScore * 0.4) + (nightScore * 0.6));
}

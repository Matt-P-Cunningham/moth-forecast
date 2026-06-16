import { MONTHS_SHORT, WINDOW_DAYS } from './config.js';

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

export function attr(value) {
  return escapeHTML(value);
}

export function licenseLabel(code) {
  if (!code) return 'license not provided';
  const c = String(code).toLowerCase();
  const labels = {
    'cc0': 'CC0', 'cc-by': 'CC BY', 'cc-by-nc': 'CC BY-NC',
    'cc-by-sa': 'CC BY-SA', 'cc-by-nd': 'CC BY-ND',
    'cc-by-nc-sa': 'CC BY-NC-SA', 'cc-by-nc-nd': 'CC BY-NC-ND'
  };
  return labels[c] || String(code).toUpperCase();
}

export function photoCreditText(moth) {
  if (!moth.photo) return '';
  const by = moth.photo.attribution || 'iNaturalist contributor';
  return `Photo: ${by} · ${licenseLabel(moth.photo.licenseCode)}`;
}

export function photoCreditHTML(moth) {
  const text = photoCreditText(moth);
  if (!text) return '';
  const url = moth.photo.pageUrl || `https://www.inaturalist.org/taxa/${moth.id}`;
  return `<a href="${attr(url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escapeHTML(text)}</a>`;
}

export function getMonths() {
  const now = new Date();
  const months = new Set();
  for (let d = -WINDOW_DAYS; d <= WINDOW_DAYS; d++) {
    const dt = new Date(now);
    dt.setDate(now.getDate() + d);
    months.add(dt.getMonth() + 1);
  }
  return [...months].join(',');
}

export function todayStr() {
  return new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
}

export function hourLabel(h) {
  let hr12 = h.hour % 12;
  if (hr12 === 0) hr12 = 12;
  return `${hr12} ${h.hour < 12 ? 'AM' : 'PM'}`;
}

export function dayLabel(h) {
  const now = new Date();
  const d = new Date(h.y, h.mo - 1, h.d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function fullLabel(h) {
  const d = new Date(h.y, h.mo - 1, h.d);
  return `${dayLabel(h)}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${hourLabel(h)}`;
}

export function seasonBars(peakMonths, currentMonth) {
  return MONTHS_SHORT.map((m, i) => {
    const mo = i + 1;
    const isCurrent = mo === currentMonth;
    const cls = peakMonths.includes(mo) ? (isCurrent ? 'peak' : 'active') : '';
    return `<div class="season-bar ${cls}" title="${m}"></div>`;
  }).join('');
}

export function estimateSeasonMonths(currentMonth) {
  const active = [];
  for (let i = -2; i <= 3; i++) active.push(((currentMonth - 1 + i + 12) % 12) + 1);
  const peak = [currentMonth, ((currentMonth % 12) + 1)];
  return { active, peak };
}

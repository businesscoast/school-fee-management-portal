/** Indian grouping: 50,00,000 */
export function groupIndian(n: number): string {
  const sign = n < 0 ? '-' : '';
  const whole = Math.round(Math.abs(n));
  const s = String(whole);
  if (s.length <= 3) return sign + s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${sign}${groups.join(',')},${last3}`;
}

export function formatINR(n: number): string {
  return `₹${groupIndian(n)}`;
}

/** ₹6.4L, ₹2.70Cr, ₹18k — for headlines and bar labels. */
export function formatINRCompact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1e7) return `${sign}₹${trim((v / 1e7).toFixed(2))}Cr`;
  if (v >= 1e5) return `${sign}₹${trim((v / 1e5).toFixed(1))}L`;
  if (v >= 1e3) return `${sign}₹${trim((v / 1e3).toFixed(1))}k`;
  return `${sign}₹${Math.round(v)}`;
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 1000) / 10}%`;
}

/**
 * Parse amounts as they appear in registers: '₹25,000', 'Rs. 25,000/-', '25000.00', '(500)'.
 * Returns null for blanks and non-numeric text.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = input.trim();
  if (!s || s === '-' || s === '–' || /^n\/?a$/i.test(s) || s.toLowerCase() === 'nil') return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/\/-$/, '').replace(/[,\s₹()]/g, '').replace(/^-/, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return negative ? -v : v;
}

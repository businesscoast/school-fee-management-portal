const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_INDEX: Record<string, number> = {};
MONTHS.forEach((m, i) => {
  MONTH_INDEX[m.toLowerCase()] = i;
  MONTH_INDEX[m.slice(0, 3).toLowerCase()] = i;
});
MONTH_INDEX['sept'] = 8;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function nowISO(now: Date = new Date()): string {
  return now.toISOString();
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

/** Days since epoch for a calendar date, timezone independent. */
function dayNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = parts(iso);
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateShort(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  const h = d.getHours();
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${hh}:${pad(d.getMinutes())} ${ampm}`;
}

function twoDigitYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Parse the date formats found in school registers: ISO, dd/mm/yyyy, dd-mm-yy,
 * 15 October 2026, 15-Oct-26, Oct 15, 2026, 2026/10/15 and Excel serial numbers.
 * Day-first is assumed for numeric forms (Indian convention) unless impossible.
 */
export function parseDateLoose(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (input > 20000 && input < 80000) {
      const t = new Date(Date.UTC(1899, 11, 30) + Math.round(input) * 86400000);
      return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    }
    return null;
  }
  const s = input.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return check(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return check(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = twoDigitYear(+m[3]);
    if (a <= 12 && b > 12) [a, b] = [b, a]; // must be mm/dd
    return check(y, b, a);
  }

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-/]+([A-Za-z]{3,9})[\s\-/,]+(\d{2,4})$/);
  if (m) {
    const mi = MONTH_INDEX[m[2].toLowerCase()];
    if (mi === undefined) return null;
    return check(twoDigitYear(+m[3]), mi + 1, +m[1]);
  }

  m = s.match(/^([A-Za-z]{3,9})[\s\-/]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{2,4})$/);
  if (m) {
    const mi = MONTH_INDEX[m[1].toLowerCase()];
    if (mi === undefined) return null;
    return check(twoDigitYear(+m[3]), mi + 1, +m[2]);
  }

  if (/^\d{5}$/.test(s)) return parseDateLoose(Number(s));
  return null;
}

function check(y: number, m: number, d: number): string | null {
  const iso = toISO(y, m, d);
  return isValidISODate(iso) ? iso : null;
}

/** Academic years run June to May: 2026-10-08 belongs to 2026-27. */
export function academicYearFor(iso: string): string {
  const [y, m] = parts(iso);
  const start = m >= 6 ? y : y - 1;
  return yearLabel(start);
}

export function yearLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function yearStartOf(year: string): number {
  return Number(year.slice(0, 4));
}

export function academicYearStart(year: string): string {
  return `${yearStartOf(year)}-06-01`;
}

export function academicYearEnd(year: string): string {
  return `${yearStartOf(year) + 1}-05-31`;
}

export function nextAcademicYear(year: string): string {
  return yearLabel(yearStartOf(year) + 1);
}

export function prevAcademicYear(year: string): string {
  return yearLabel(yearStartOf(year) - 1);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Twelve YYYY-MM keys from June of the start year to May of the next. */
export function academicMonths(year: string): string[] {
  const start = yearStartOf(year);
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = 6 + i;
    const y = m > 12 ? start + 1 : start;
    keys.push(`${y}-${pad(((m - 1) % 12) + 1)}`);
  }
  return keys;
}

export function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS[m - 1].slice(0, 3);
}

export function monthLabelLong(key: string): string {
  const m = Number(key.slice(5, 7));
  return `${MONTHS[m - 1]} ${key.slice(0, 4)}`;
}

/** Accepts '2026-27', '2026-2027', '2026/27', '2026' and returns the canonical label. */
export function parseAcademicYear(input: string): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})\s*[-/–]\s*(\d{2}|\d{4})$/);
  if (m) {
    const start = +m[1];
    const end = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    if (end !== start + 1) return null;
    return yearLabel(start);
  }
  m = s.match(/^(\d{4})$/);
  if (m) return yearLabel(+m[1]);
  return null;
}

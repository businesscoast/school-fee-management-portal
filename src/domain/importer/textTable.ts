import type { SourceKind } from '../types';
import { guessField } from './mapping';

export interface RawTable {
  headers: string[];
  rows: string[][];
  sourceKind: SourceKind;
  notes: string[];
}

export interface PositionedItem {
  x: number;
  y: number;
  w: number;
  str: string;
}

/** Number of cells that look like known register headers. */
export function headerScore(cells: string[]): number {
  let score = 0;
  for (const c of cells) {
    const s = c.trim();
    if (!s || /^[\d₹,.\-/ ]+$/.test(s)) continue;
    if (guessField(s) !== 'ignore') score++;
  }
  return score;
}

/** Index of the most header-like row within the first 30 rows, or -1. */
export function findHeaderRow(rows: string[][]): number {
  let best = -1;
  let bestScore = 1;
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** Split a text line into cells on tabs, pipes, or runs of two or more spaces. */
export function splitLine(line: string): string[] {
  const trimmed = line.replace(/\s+$/, '');
  if (trimmed.includes('\t')) return trimmed.split('\t').map((c) => c.trim());
  if (trimmed.includes('|')) return trimmed.split('|').map((c) => c.trim()).filter((c, i, arr) => !(c === '' && (i === 0 || i === arr.length - 1)));
  return trimmed.trim().split(/\s{2,}/).map((c) => c.trim());
}

function isBlank(cells: string[]): boolean {
  return cells.every((c) => !c.trim());
}

/** Build a table from plain text lines (OCR output, text PDF without positions). */
export function tableFromLines(lines: string[], sourceKind: SourceKind, notes: string[] = []): RawTable {
  const rows = lines.map(splitLine).filter((r) => !isBlank(r));
  return finishTable(rows, sourceKind, notes);
}

export function finishTable(rows: string[][], sourceKind: SourceKind, notes: string[] = []): RawTable {
  if (rows.length === 0) return { headers: [], rows: [], sourceKind, notes: [...notes, 'No text could be read from this file.'] };
  const headerIndex = findHeaderRow(rows);
  let headers: string[];
  let body: string[][];
  if (headerIndex >= 0) {
    headers = rows[headerIndex].map((h) => h.trim());
    body = rows.slice(headerIndex + 1);
    if (headerIndex > 0) notes.push(`Skipped ${headerIndex} line${headerIndex === 1 ? '' : 's'} above the header row.`);
  } else {
    const width = Math.max(...rows.map((r) => r.length));
    headers = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    body = rows;
    notes.push('No header row was recognised; map the columns manually.');
  }
  const width = headers.length;
  body = body
    .filter((r) => !isBlank(r))
    .filter((r) => headerScore(r) < Math.max(2, Math.floor(width / 2)) || r.join(' ') !== headers.join(' ')) // drop repeated headers on later pages
    .map((r) => {
      const out = r.slice(0, width);
      while (out.length < width) out.push('');
      return out;
    });
  return { headers, rows: body, sourceKind, notes };
}

/**
 * Group positioned text items (PDF.js text content) into lines, top to bottom,
 * merging items that sit close together on the same line into one cell.
 */
export function groupIntoLines(items: PositionedItem[], yTolerance = 2.5, gap = 4): PositionedItem[][] {
  const sorted = items.filter((it) => it.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedItem[][] = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - it.y) <= yTolerance) line.push(it);
    else lines.push([it]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const merged: PositionedItem[] = [];
    for (const it of line) {
      const last = merged[merged.length - 1];
      if (last && it.x - (last.x + last.w) < gap) {
        const joiner = it.x - (last.x + last.w) > 0.8 && !last.str.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
        last.str = `${last.str}${joiner}${it.str}`;
        last.w = it.x + it.w - last.x;
      } else {
        merged.push({ ...it });
      }
    }
    return merged.map((m) => ({ ...m, str: m.str.replace(/\s+/g, ' ').trim() }));
  });
}

/** Turn positioned lines into a table by aligning cells under the header columns. */
export function tableFromPositionedLines(lines: PositionedItem[][], sourceKind: SourceKind, notes: string[] = []): RawTable {
  const textRows = lines.map((l) => l.map((c) => c.str));
  const headerIndex = findHeaderRow(textRows);
  if (headerIndex < 0) return finishTable(textRows, sourceKind, notes);

  const columns = lines[headerIndex].map((c) => ({ start: c.x, end: c.x + c.w, center: c.x + c.w / 2 }));
  const headers = lines[headerIndex].map((c) => c.str);
  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = new Array<string>(columns.length).fill('');
    for (const item of line) {
      const col = nearestColumn(columns, item);
      cells[col] = cells[col] ? `${cells[col]} ${item.str}` : item.str;
    }
    if (cells.every((c) => !c)) continue;
    if (cells.join(' ') === headers.join(' ')) continue;
    rows.push(cells);
  }
  if (headerIndex > 0) notes.push(`Skipped ${headerIndex} line${headerIndex === 1 ? '' : 's'} above the header row.`);
  return { headers, rows, sourceKind, notes };
}

function nearestColumn(columns: { start: number; end: number; center: number }[], item: PositionedItem): number {
  const s = item.x;
  const e = item.x + item.w;
  let best = 0;
  let bestOverlap = -Infinity;
  columns.forEach((c, i) => {
    const overlap = Math.min(e, c.end) - Math.max(s, c.start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = i;
    }
  });
  if (bestOverlap > 0) return best;
  const center = (s + e) / 2;
  let nearest = 0;
  let dist = Infinity;
  columns.forEach((c, i) => {
    const d = Math.min(Math.abs(center - c.center), Math.abs(s - c.start), Math.abs(e - c.end));
    if (d < dist) {
      dist = d;
      nearest = i;
    }
  });
  return nearest;
}

import { describe, expect, it } from 'vitest';
import { groupIntoLines, tableFromLines, tableFromPositionedLines } from '../src/domain/importer/textTable';

describe('text to table', () => {
  it('finds the header row in OCR-style text', () => {
    const lines = [
      'Sunrise Public School',
      'Fee Register 2026-27',
      'Admission No   Student Name     Class   Total Fee   Paid     Balance   Due Date',
      '1001           Rahul Sharma     8-A     25,000      15,000   10,000    15/10/2026',
      '1002           Ananya Rao       8-A     25,000      25,000   0         15/09/2026',
    ];
    const t = tableFromLines(lines, 'image');
    expect(t.headers).toEqual(['Admission No', 'Student Name', 'Class', 'Total Fee', 'Paid', 'Balance', 'Due Date']);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][1]).toBe('Rahul Sharma');
    expect(t.notes[0]).toContain('Skipped 2 lines');
  });
  it('aligns positioned PDF text under header columns', () => {
    const items = [
      { x: 10, y: 700, w: 60, str: 'Admission No' },
      { x: 100, y: 700, w: 70, str: 'Student Name' },
      { x: 200, y: 700, w: 30, str: 'Class' },
      { x: 260, y: 700, w: 45, str: 'Total Fee' },
      { x: 330, y: 700, w: 25, str: 'Paid' },
      { x: 10, y: 680, w: 25, str: '1001' },
      { x: 100, y: 680, w: 28, str: 'Rahul' },
      { x: 130, y: 680.4, w: 36, str: 'Sharma' },
      { x: 205, y: 680, w: 18, str: '8-A' },
      { x: 275, y: 680, w: 30, str: '25,000' },
      { x: 335, y: 680, w: 30, str: '15,000' },
    ];
    const lines = groupIntoLines(items);
    expect(lines).toHaveLength(2);
    const t = tableFromPositionedLines(lines, 'pdf');
    expect(t.headers).toEqual(['Admission No', 'Student Name', 'Class', 'Total Fee', 'Paid']);
    expect(t.rows[0]).toEqual(['1001', 'Rahul Sharma', '8-A', '25,000', '15,000']);
  });
});

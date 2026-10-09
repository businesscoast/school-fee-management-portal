import { describe, expect, it } from 'vitest';
import { academicMonths, academicYearFor, addDays, daysBetween, parseAcademicYear, parseDateLoose } from '../src/domain/dates';

describe('parseDateLoose', () => {
  it('reads the formats found in registers', () => {
    expect(parseDateLoose('2026-10-15')).toBe('2026-10-15');
    expect(parseDateLoose('15/10/2026')).toBe('2026-10-15');
    expect(parseDateLoose('15-10-26')).toBe('2026-10-15');
    expect(parseDateLoose('10/15/2026')).toBe('2026-10-15');
    expect(parseDateLoose('15 October 2026')).toBe('2026-10-15');
    expect(parseDateLoose('15-Oct-26')).toBe('2026-10-15');
    expect(parseDateLoose('Oct 15, 2026')).toBe('2026-10-15');
    expect(parseDateLoose('2026/10/15')).toBe('2026-10-15');
    expect(parseDateLoose(46310)).toBe('2026-10-15');
  });
  it('rejects impossible dates', () => {
    expect(parseDateLoose('31/02/2026')).toBeNull();
    expect(parseDateLoose('soon')).toBeNull();
    expect(parseDateLoose('')).toBeNull();
  });
});

describe('academic calendar', () => {
  it('runs June to May', () => {
    expect(academicYearFor('2026-10-08')).toBe('2026-27');
    expect(academicYearFor('2027-03-01')).toBe('2026-27');
    expect(academicYearFor('2027-06-01')).toBe('2027-28');
    expect(academicMonths('2026-27')[0]).toBe('2026-06');
    expect(academicMonths('2026-27')[11]).toBe('2027-05');
  });
  it('parses year labels', () => {
    expect(parseAcademicYear('2026-27')).toBe('2026-27');
    expect(parseAcademicYear('2026-2027')).toBe('2026-27');
    expect(parseAcademicYear('2026/28')).toBeNull();
  });
  it('does day arithmetic without timezone drift', () => {
    expect(addDays('2026-10-08', 7)).toBe('2026-10-15');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-08', '2026-10-15')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
  });
});

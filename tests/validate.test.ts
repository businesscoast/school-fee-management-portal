import { describe, expect, it } from 'vitest';
import type { ValidationContext } from '../src/domain/importer/validate';
import { importStats, nameSimilarity, normalizeClass, validateRecords } from '../src/domain/importer/validate';

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    existing: new Map([['1001', { name: 'Rahul Sharma', className: '8', section: 'A', totalFee: 25000, paid: 15000, dueDate: '2026-10-15' }]]),
    existingReceipts: new Set(['R26-00001']),
    feeStructure: { '8': 25000, '1': 16000 },
    year: '2026-27',
    today: '2026-10-08',
    sourceKind: 'csv',
    rowMode: 'student',
    ...overrides,
  };
}

describe('normalizeClass', () => {
  it('accepts the ways schools write classes', () => {
    expect(normalizeClass('8')).toEqual({ className: '8', section: '' });
    expect(normalizeClass('8-A')).toEqual({ className: '8', section: 'A' });
    expect(normalizeClass('8A')).toEqual({ className: '8', section: 'A' });
    expect(normalizeClass('VIII A')).toEqual({ className: '8', section: 'A' });
    expect(normalizeClass('Class 10 / B')).toEqual({ className: '10', section: 'B' });
    expect(normalizeClass('LKG')).toEqual({ className: 'LKG', section: '' });
    expect(normalizeClass('Senior')).toBeNull();
  });
});

describe('validation', () => {
  it('passes a clean existing-student row and computes the payment to add', () => {
    const [rec] = validateRecords([{ rowIndex: 1, raw: { admissionNo: '1001', name: 'Rahul Sharma', className: '8', section: 'A', totalFee: '25000', paidAmount: '20,000', balance: '5000', dueDate: '15/10/2026', receiptNo: 'R26-90001', paymentDate: '05/10/2026' } }], ctx());
    expect(rec.issues).toEqual([]);
    expect(rec.confidence).toBe(1);
    expect(rec.needsReview).toBe(false);
    expect(rec.match).toBe('existing');
    expect(rec.paymentToAdd).toBe(5000);
    expect(rec.parsed.dueDate).toBe('2026-10-15');
  });
  it('flags the error cases', () => {
    const recs = validateRecords(
      [
        { rowIndex: 1, raw: { admissionNo: '', name: 'X Y', className: '8', totalFee: '25000', paidAmount: '0' } },
        { rowIndex: 2, raw: { admissionNo: '1001', paidAmount: 'Twenty thousand' } },
        { rowIndex: 3, raw: { admissionNo: '1001', paidAmount: '30000' } },
        { rowIndex: 4, raw: { admissionNo: '1001', dueDate: '31/02/2026' } },
        { rowIndex: 5, raw: { admissionNo: '1001', paidAmount: '20000', receiptNo: 'R26-00001' } },
        { rowIndex: 6, raw: { admissionNo: 'NEW-1', name: 'Aarohi Kulkarni', totalFee: '20000' } },
      ],
      ctx(),
    );
    expect(recs[0].issues[0].message).toMatch(/Admission number is missing/);
    expect(recs[1].issues.some((i) => i.message.includes('not a number'))).toBe(true);
    expect(recs[2].issues.some((i) => i.message.includes('exceeds the total fee'))).toBe(true);
    expect(recs[3].issues.some((i) => i.message.includes('not a valid date'))).toBe(true);
    expect(recs[4].issues.some((i) => i.message.includes('already recorded'))).toBe(true);
    expect(recs[5].issues.some((i) => i.message.includes('Class is required'))).toBe(true);
    expect(recs.every((r) => r.needsReview)).toBe(true);
    // Rows 2-4 duplicate admission 1001 within the file as well.
    expect(recs[2].issues.some((i) => i.message.includes('already appears in row 2'))).toBe(true);
  });
  it('turns two warnings into a review item and keeps one warning importable', () => {
    const [one, two] = validateRecords(
      [
        { rowIndex: 1, raw: { admissionNo: '1001', name: 'R. Sharma', paidAmount: '15000' } },
        { rowIndex: 2, raw: { admissionNo: '1002', name: 'Ananya Rao', className: '8-B', paidAmount: '15000', balance: '9000' } },
      ],
      ctx({ existing: new Map([...ctx().existing, ['1002', { name: 'Ananya Rao', className: '8', section: 'B', totalFee: 25000, paid: 15000, dueDate: '2026-10-15' }]]) }),
    );
    expect(one.issues.map((i) => i.level)).toEqual(['warning']);
    expect(one.needsReview).toBe(false);
    expect(one.paymentToAdd).toBe(0);
    expect(two.issues.filter((i) => i.level === 'warning')).toHaveLength(1);
    expect(two.needsReview).toBe(false);
  });
  it('fills a new student from the fee structure with a warning', () => {
    const [rec] = validateRecords([{ rowIndex: 1, raw: { admissionNo: '3001', name: 'New Kid', className: '1-A', paidAmount: '0' } }], ctx());
    expect(rec.match).toBe('new');
    expect(rec.parsed.totalFee).toBe(16000);
    expect(rec.parsed.section).toBe('A');
    expect(rec.issues.filter((i) => i.level === 'warning')).toHaveLength(2); // fee + due date defaults
    expect(rec.needsReview).toBe(true);
  });
  it('supports one-row-per-receipt files', () => {
    const recs = validateRecords(
      [
        { rowIndex: 1, raw: { admissionNo: '1001', paidAmount: '5000', receiptNo: 'A1' } },
        { rowIndex: 2, raw: { admissionNo: '1001', paidAmount: '6000', receiptNo: 'A2' } },
      ],
      ctx({ rowMode: 'receipt' }),
    );
    expect(recs[0].issues).toEqual([]);
    expect(recs[0].paymentToAdd).toBe(5000);
    expect(recs[1].issues.some((i) => i.message.includes('above the total fee'))).toBe(true);
    expect(importStats(recs)).toMatchObject({ identified: 2, review: 1, ready: 1 });
  });
  it('lowers confidence for scanned sources', () => {
    const [rec] = validateRecords([{ rowIndex: 1, raw: { admissionNo: '1001', name: 'Rahul Sharma', paidAmount: '15000', balance: '9000' } }], ctx({ sourceKind: 'image' }));
    expect(rec.confidence).toBe(0.65);
    expect(rec.needsReview).toBe(true);
  });
  it('compares names leniently', () => {
    expect(nameSimilarity('Rahul Sharma', 'rahul  sharma')).toBe(1);
    expect(nameSimilarity('Rahul Sharma', 'Rahul Sharmaa')).toBeGreaterThan(0.8);
    expect(nameSimilarity('Rahul Sharma', 'R. Sharma')).toBeLessThan(0.8);
  });
});

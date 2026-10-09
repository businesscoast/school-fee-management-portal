import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { guessMapping } from '../src/domain/importer/mapping';
import { applyImport } from '../src/domain/importer/commit';
import { importStats, validateAll } from '../src/domain/importer/validate';
import { classRows, monthlyCollection, sectionRows, summarize } from '../src/domain/metrics';
import { buildFeeViews } from '../src/domain/status';
import { buildNewAdmissions, buildSampleRegister } from '../src/store/sample';
import { generateSeed } from '../src/store/seed';

const TODAY = '2026-10-08';
const data = generateSeed(TODAY);
const views = buildFeeViews(data, '2026-27', TODAY);

function csvToTable(csv: string) {
  const wb = XLSX.read(csv, { type: 'string', raw: false });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  return { headers: rows[0].map(String), rows: rows.slice(1).map((r) => r.map((c) => String(c ?? ''))), sourceKind: 'csv' as const, notes: [] };
}

function contextFor(year: string) {
  const yearViews = buildFeeViews(data, year, TODAY);
  return {
    existing: new Map(yearViews.map((v) => [v.student.admissionNo, { name: v.student.name, className: v.record.className, section: v.record.section, totalFee: v.record.totalFee, paid: v.paid, dueDate: v.record.dueDate }])),
    existingReceipts: new Set(data.payments.map((p) => p.receiptNo)),
    feeStructure: data.feeStructure[year],
    year,
    today: TODAY,
    sourceKind: 'csv' as const,
    rowMode: 'student' as const,
  };
}

describe('seed data', () => {
  it('matches the proposal headline counts', () => {
    const s = summarize(views);
    expect(data.years).toEqual(['2025-26', '2026-27', '2027-28']);
    expect(data.currentYear).toBe('2026-27');
    expect(s.totalStudents).toBe(1248);
    expect(s.fullyPaid).toBe(1071);
    expect(s.partiallyPaid).toBe(103);
    expect(s.unpaid).toBe(74);
    expect(s.overdue).toBe(31);
    expect(s.dueToday).toBe(7);
    expect(s.dueWithin3).toBe(23);
    expect(s.dueWithin7).toBe(42);
    expect(s.topOutstandingClass?.label).toBe('Class 8');
    expect(s.expected - s.collected).toBe(s.outstanding);
  });
  it('matches the class-wise example rows', () => {
    const rows = sectionRows(views);
    const row = (label: string) => rows.find((r) => r.label === label)!;
    expect(row('6-A')).toMatchObject({ students: 42, fullyPaid: 39 });
    expect(row('6-B')).toMatchObject({ students: 40, fullyPaid: 36 });
    expect(row('7-A')).toMatchObject({ students: 44, fullyPaid: 41 });
    expect(row('7-B')).toMatchObject({ students: 43, fullyPaid: 35 });
    expect(row('8-A')).toMatchObject({ students: 42, fullyPaid: 31 });
    expect(classRows(views)).toHaveLength(10);
  });
  it('contains the worked example student', () => {
    const rahul = views.find((v) => v.student.admissionNo === '1001')!;
    expect(rahul.student.name).toBe('Rahul Sharma');
    expect(rahul.classLabel).toBe('8-A');
    expect(rahul.record.totalFee).toBe(25000);
    expect(rahul.paid).toBe(15000);
    expect(rahul.outstanding).toBe(10000);
    expect(rahul.record.dueDate).toBe('2026-10-15');
    expect(rahul.status).toBe('Partially Paid');
    expect(rahul.payments.map((p) => [p.date, p.amount])).toEqual([['2026-06-10', 10000], ['2026-08-10', 5000]]);
  });
  it('has collections every month so far and unique receipts', () => {
    const months = monthlyCollection(views, '2026-27');
    expect(months.slice(0, 5).every((m) => m.amount > 0)).toBe(true);
    expect(months.slice(5).every((m) => m.amount === 0)).toBe(true);
    const receipts = data.payments.map((p) => p.receiptNo);
    expect(new Set(receipts).size).toBe(receipts.length);
    expect(data.payments.every((p) => p.date <= TODAY)).toBe(true);
  });
  it('has previous and future years for every eligible student', () => {
    expect(buildFeeViews(data, '2025-26', TODAY).length).toBeGreaterThan(1000);
    const next = buildFeeViews(data, '2027-28', TODAY);
    expect(next.length).toBeGreaterThan(1000);
    expect(next.every((v) => v.paid === 0)).toBe(true);
  });
});

describe('sample files', () => {
  it('the term register yields 486 identified, 479 ready, 7 to review', () => {
    const { csv } = buildSampleRegister(data, '2026-27', TODAY);
    const table = csvToTable(csv);
    const mapping = guessMapping(table.headers, table.rows);
    expect(mapping).toEqual(['admissionNo', 'name', 'className', 'section', 'guardianName', 'phone', 'totalFee', 'paidAmount', 'balance', 'dueDate', 'receiptNo', 'paymentDate']);
    const records = validateAll(table, mapping, contextFor('2026-27'));
    const stats = importStats(records);
    expect(stats.identified).toBe(486);
    expect(stats.ready).toBe(479);
    expect(stats.review).toBe(7);
    const result = applyImport(data, records, { year: '2026-27', fileName: 'x.csv', sourceKind: 'csv', today: TODAY, now: '2026-10-08T10:00:00Z', rowMode: 'student' });
    expect(result.batch.imported).toBe(480); // six rows have errors; the seventh review row carries warnings only
    expect(result.batch.reviewed).toBe(1);
    expect(result.batch.skipped).toBe(6);
    expect(result.batch.paymentsAdded).toBe(40);
    const after = summarize(buildFeeViews(result.data, '2026-27', TODAY));
    const before = summarize(views);
    expect(after.collected).toBeGreaterThan(before.collected);
    expect(after.totalStudents).toBe(1248);
  });
  it('the new admissions file creates sixty class-1 students next year', () => {
    const { csv } = buildNewAdmissions(data, '2027-28');
    const table = csvToTable(csv);
    const mapping = guessMapping(table.headers, table.rows);
    expect(mapping).toContain('classSection');
    const records = validateAll(table, mapping, contextFor('2027-28'));
    expect(records).toHaveLength(60);
    expect(records.every((r) => r.match === 'new' && !r.needsReview)).toBe(true);
    const result = applyImport(data, records, { year: '2027-28', fileName: 'new.csv', sourceKind: 'csv', today: TODAY, now: '2026-10-08T10:00:00Z', rowMode: 'student' });
    expect(result.batch.studentsCreated).toBe(60);
    expect(buildFeeViews(result.data, '2027-28', TODAY).filter((v) => v.record.className === '1')).toHaveLength(60);
  });
});

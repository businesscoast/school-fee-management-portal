import { academicMonths, monthKey, monthLabel } from './dates';
import { classSortKey } from './status';
import type { FeeView } from './types';
import { classLabel } from './types';

export interface Summary {
  totalStudents: number;
  expected: number;
  collected: number;
  outstanding: number;
  fullyPaid: number;
  partiallyPaid: number;
  unpaid: number;
  overdue: number;
  overdueAmount: number;
  dueToday: number;
  dueWithin3: number;
  dueWithin7: number;
  collectionPct: number; // 0..1
  topOutstandingClass: { label: string; outstanding: number } | null;
}

export function summarize(views: FeeView[]): Summary {
  const s: Summary = {
    totalStudents: views.length,
    expected: 0,
    collected: 0,
    outstanding: 0,
    fullyPaid: 0,
    partiallyPaid: 0,
    unpaid: 0,
    overdue: 0,
    overdueAmount: 0,
    dueToday: 0,
    dueWithin3: 0,
    dueWithin7: 0,
    collectionPct: 0,
    topOutstandingClass: null,
  };
  const byClass = new Map<string, number>();
  for (const v of views) {
    s.expected += v.record.totalFee;
    s.collected += Math.min(v.paid, v.record.totalFee);
    s.outstanding += v.outstanding;
    if (v.payStatus === 'Fully Paid') s.fullyPaid++;
    else if (v.payStatus === 'Partially Paid') s.partiallyPaid++;
    else s.unpaid++;
    if (v.bucket === 'overdue') {
      s.overdue++;
      s.overdueAmount += v.outstanding;
    }
    if (v.bucket === 'today') s.dueToday++;
    if (v.bucket === 'today' || v.bucket === 'within3') s.dueWithin3++;
    if (v.bucket === 'today' || v.bucket === 'within3' || v.bucket === 'within7') s.dueWithin7++;
    if (v.outstanding > 0) {
      byClass.set(v.record.className, (byClass.get(v.record.className) ?? 0) + v.outstanding);
    }
  }
  s.collectionPct = s.expected > 0 ? s.collected / s.expected : 0;
  let top: Summary['topOutstandingClass'] = null;
  for (const [className, outstanding] of byClass) {
    if (!top || outstanding > top.outstanding) top = { label: `Class ${className}`, outstanding };
  }
  s.topOutstandingClass = top;
  return s;
}

export interface ClassRow {
  className: string;
  section: string;
  label: string;
  students: number;
  fullyPaid: number;
  partiallyPaid: number;
  unpaid: number;
  overdue: number;
  expected: number;
  collected: number;
  outstanding: number;
  pct: number;
}

function emptyRow(className: string, section: string): ClassRow {
  return {
    className,
    section,
    label: section ? classLabel(className, section) : `Class ${className}`,
    students: 0,
    fullyPaid: 0,
    partiallyPaid: 0,
    unpaid: 0,
    overdue: 0,
    expected: 0,
    collected: 0,
    outstanding: 0,
    pct: 0,
  };
}

function accumulate(row: ClassRow, v: FeeView) {
  row.students++;
  if (v.payStatus === 'Fully Paid') row.fullyPaid++;
  else if (v.payStatus === 'Partially Paid') row.partiallyPaid++;
  else row.unpaid++;
  if (v.bucket === 'overdue') row.overdue++;
  row.expected += v.record.totalFee;
  row.collected += Math.min(v.paid, v.record.totalFee);
  row.outstanding += v.outstanding;
}

function finish(rows: ClassRow[]): ClassRow[] {
  for (const r of rows) r.pct = r.expected > 0 ? r.collected / r.expected : 0;
  rows.sort((a, b) => classSortKey(a.className) - classSortKey(b.className) || a.section.localeCompare(b.section));
  return rows;
}

/** One row per class-section. */
export function sectionRows(views: FeeView[]): ClassRow[] {
  const map = new Map<string, ClassRow>();
  for (const v of views) {
    const key = classLabel(v.record.className, v.record.section);
    let row = map.get(key);
    if (!row) {
      row = emptyRow(v.record.className, v.record.section);
      map.set(key, row);
    }
    accumulate(row, v);
  }
  return finish([...map.values()]);
}

/** One row per class (all sections combined). */
export function classRows(views: FeeView[]): ClassRow[] {
  const map = new Map<string, ClassRow>();
  for (const v of views) {
    let row = map.get(v.record.className);
    if (!row) {
      row = emptyRow(v.record.className, '');
      map.set(v.record.className, row);
    }
    accumulate(row, v);
  }
  return finish([...map.values()]);
}

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string; // Jun
  amount: number;
  count: number;
}

/** Collection per month across the academic year (June to May). */
export function monthlyCollection(views: FeeView[], year: string): MonthPoint[] {
  const points = academicMonths(year).map((key) => ({ key, label: monthLabel(key), amount: 0, count: 0 }));
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const v of views) {
    for (const p of v.payments) {
      const i = index.get(monthKey(p.date));
      if (i === undefined) continue;
      points[i].amount += p.amount;
      points[i].count++;
    }
  }
  return points;
}

export function paymentModeBreakdown(views: FeeView[]): { mode: string; amount: number; count: number }[] {
  const map = new Map<string, { mode: string; amount: number; count: number }>();
  for (const v of views) {
    for (const p of v.payments) {
      let row = map.get(p.mode);
      if (!row) {
        row = { mode: p.mode, amount: 0, count: 0 };
        map.set(p.mode, row);
      }
      row.amount += p.amount;
      row.count++;
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

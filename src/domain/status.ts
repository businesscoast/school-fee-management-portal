import { daysBetween } from './dates';
import type { AppData, DisplayStatus, DueBucket, FeeView, PayStatus } from './types';
import { classLabel } from './types';

export function paymentStatus(totalFee: number, paid: number): PayStatus {
  if (totalFee <= 0) return 'Fully Paid';
  if (paid >= totalFee) return 'Fully Paid';
  if (paid > 0) return 'Partially Paid';
  return 'Unpaid';
}

export function dueBucket(outstanding: number, dueDate: string, today: string): DueBucket {
  if (outstanding <= 0 || !dueDate) return 'none';
  const d = daysBetween(today, dueDate);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 3) return 'within3';
  if (d <= 7) return 'within7';
  return 'later';
}

export function displayStatus(payStatus: PayStatus, bucket: DueBucket): DisplayStatus {
  if (payStatus !== 'Fully Paid' && bucket === 'overdue') return 'Overdue';
  return payStatus;
}

/** All fee views for one academic year, sorted by class, section and name. */
export function buildFeeViews(data: AppData, year: string, today: string): FeeView[] {
  const students = new Map(data.students.map((s) => [s.admissionNo, s]));
  const paymentsByRecord = new Map<string, FeeView['payments']>();
  for (const p of data.payments) {
    const list = paymentsByRecord.get(p.feeRecordId);
    if (list) list.push(p);
    else paymentsByRecord.set(p.feeRecordId, [p]);
  }
  const views: FeeView[] = [];
  for (const record of data.feeRecords) {
    if (record.academicYear !== year) continue;
    const student = students.get(record.admissionNo);
    if (!student) continue;
    const payments = (paymentsByRecord.get(record.id) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, record.totalFee - paid);
    const payStatus = paymentStatus(record.totalFee, paid);
    const bucket = dueBucket(outstanding, record.dueDate, today);
    views.push({
      student,
      record,
      payments,
      paid,
      outstanding,
      payStatus,
      status: displayStatus(payStatus, bucket),
      daysToDue: record.dueDate ? daysBetween(today, record.dueDate) : 0,
      bucket,
      classLabel: classLabel(record.className, record.section),
    });
  }
  views.sort(compareViews);
  return views;
}

export function classSortKey(className: string): number {
  const special: Record<string, number> = { nursery: -3, lkg: -2, ukg: -1, kg: -1 };
  const key = className.trim().toLowerCase();
  if (key in special) return special[key];
  const n = Number(key);
  return Number.isFinite(n) ? n : 100;
}

export function compareViews(a: FeeView, b: FeeView): number {
  const ca = classSortKey(a.record.className);
  const cb = classSortKey(b.record.className);
  if (ca !== cb) return ca - cb;
  if (a.record.section !== b.record.section) return a.record.section < b.record.section ? -1 : 1;
  return a.student.name.localeCompare(b.student.name);
}

export function matchesStatusFilter(view: FeeView, filter: DisplayStatus | 'All' | 'Outstanding'): boolean {
  if (filter === 'All') return true;
  if (filter === 'Outstanding') return view.outstanding > 0;
  if (filter === 'Overdue') return view.bucket === 'overdue';
  return view.payStatus === filter;
}

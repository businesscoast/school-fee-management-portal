import { academicYearStart, addDays, formatDateShort } from '../domain/dates';
import { buildFeeViews } from '../domain/status';
import type { AppData, FeeView } from '../domain/types';
import { FIRST_NAMES, LAST_NAMES, PARENT_FIRST, int, pick, rng } from './names';

export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

function ddmmyyyy(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * A "term collection register" for the current year: 486 rows covering classes 5-8,
 * with new payments for some students and exactly seven rows that need review.
 */
export function buildSampleRegister(data: AppData, year: string, today: string): { fileName: string; csv: string } {
  const r = rng(486);
  const views = buildFeeViews(data, year, today).filter((v) => ['5', '6', '7', '8'].includes(v.record.className));
  const chosen = views.slice(0, 485);
  const allReceipts = data.payments.map((p) => p.receiptNo).filter(Boolean);
  const header = ['Admission No', 'Student Name', 'Class', 'Section', 'Parent / Guardian', 'Mobile', 'Total Fee', 'Amount Paid', 'Balance', 'Due Date', 'Receipt No', 'Payment Date'];

  const withOutstanding = chosen.filter((v) => v.outstanding > 0);
  const paidUp = chosen.filter((v) => v.outstanding === 0);
  const newPayments = new Map<FeeView, { amount: number; receipt: string; date: string }>();
  withOutstanding.slice(0, 40).forEach((v, i) => {
    const fraction = r() < 0.5 ? 1 : 0.5;
    const amount = Math.max(500, Math.round((v.outstanding * fraction) / 500) * 500);
    newPayments.set(v, { amount: Math.min(amount, v.outstanding), receipt: `R${year.slice(2, 4)}-9${String(1001 + i).padStart(4, '0')}`, date: addDays(today, -int(r, 0, 5)) });
  });

  // Problem rows (seven in total, including one appended new student without a class).
  const problems = new Map<FeeView, string>();
  problems.set(paidUp[11], 'missing-admission');
  problems.set(paidUp[56], 'paid-text');
  problems.set(paidUp[100], 'paid-over');
  problems.set(paidUp[187], 'bad-date');
  problems.set(paidUp[242], 'name-and-balance');
  const dupTarget = withOutstanding[41] ?? withOutstanding[0];
  newPayments.set(dupTarget, { amount: Math.min(1000, dupTarget.outstanding), receipt: allReceipts[int(r, 0, allReceipts.length - 1)], date: today });
  problems.set(dupTarget, 'dup-receipt');

  const rows: (string | number)[][] = [header];
  for (const v of chosen) {
    const np = newPayments.get(v);
    const paid = v.paid + (np?.amount ?? 0);
    const last = np ?? (v.payments.length ? { receipt: v.payments[v.payments.length - 1].receiptNo, date: v.payments[v.payments.length - 1].date } : { receipt: '', date: '' });
    let admissionNo: string | number = v.student.admissionNo;
    let name = v.student.name;
    let paidCell: string | number = paid;
    let balance: string | number = v.record.totalFee - paid;
    let due = ddmmyyyy(v.record.dueDate);
    switch (problems.get(v)) {
      case 'missing-admission':
        admissionNo = '';
        break;
      case 'paid-text':
        paidCell = 'Twenty thousand';
        break;
      case 'paid-over':
        paidCell = v.record.totalFee + 5000;
        balance = -5000;
        break;
      case 'bad-date':
        due = '31/02/2026';
        break;
      case 'name-and-balance': {
        const [first, ...rest] = name.split(' ');
        name = `${first[0]}. ${rest.join(' ')}`;
        balance = (balance as number) + 1000;
        break;
      }
      default:
        break;
    }
    rows.push([admissionNo, name, v.record.className, v.record.section, v.student.guardianName, v.student.phone, v.record.totalFee, paidCell, balance, due, last.receipt, ddmmyyyy(last.date)]);
  }
  rows.push(['NEW-' + year.slice(0, 4) + '-01', 'Aarohi Kulkarni', '', '', 'Mrs. Sunita Kulkarni', '9811122233', 20000, 0, 20000, ddmmyyyy(addDays(today, 30)), '', '']);
  return { fileName: `fee-register-${year}-term2.csv`, csv: toCSV(rows) };
}

/** Sixty new class-1 admissions for the next academic year, as a school office might type them. */
export function buildNewAdmissions(data: AppData, year: string): { fileName: string; csv: string } {
  const r = rng(2027);
  const maxAdm = data.students.reduce((max, s) => Math.max(max, Number(s.admissionNo) || 0), 1000);
  const fee = data.feeStructure[year]?.['1'] ?? 17000;
  const due = addDays(academicYearStart(year), 44);
  const header = ['Admission No', 'Student Name', 'Class & Section', 'Parent / Guardian', 'Mobile', 'Email', 'Annual Fee', 'Paid', 'Due Date', 'Academic Year'];
  const rows: (string | number)[][] = [header];
  for (let i = 0; i < 60; i++) {
    const last = pick(r, LAST_NAMES);
    const parent = pick(r, PARENT_FIRST);
    rows.push([
      maxAdm + 1 + i,
      `${pick(r, FIRST_NAMES)} ${last}`,
      `1-${['A', 'B', 'C'][i % 3]}`,
      `${parent} ${last}`,
      `+91 9${int(r, 100000000, 999999999)}`,
      r() < 0.5 ? `${parent.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com` : '',
      `₹${fee.toLocaleString('en-IN')}`,
      0,
      formatDateShort(due),
      year,
    ]);
  }
  return { fileName: `new-admissions-${year}.csv`, csv: toCSV(rows) };
}

import { academicYearFor, academicYearStart, addDays, daysBetween, nextAcademicYear, prevAcademicYear, todayISO, yearStartOf } from '../domain/dates';
import type { AppData, FeeRecord, Payment, PaymentMode, Student } from '../domain/types';
import { feeRecordId } from '../domain/types';
import { FIRST_NAMES, LAST_NAMES, PARENT_FIRST, int, pick, rng, shuffle } from './names';

export const DATA_VERSION = 1;
export const DEFAULT_SCHOOL_NAME = 'Sunrise Public School';

export const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C'];

const BASE_FEES: Record<string, number> = {
  LKG: 14000,
  UKG: 15000,
  '1': 16000,
  '2': 17000,
  '3': 18000,
  '4': 19000,
  '5': 20000,
  '6': 22000,
  '7': 23500,
  '8': 25000,
  '9': 27000,
  '10': 29000,
};

/** Fee structure for a year, drifting 5% per year from the current year's base. */
export function feeStructureFor(year: string, currentYear: string): Record<string, number> {
  const diff = yearStartOf(year) - yearStartOf(currentYear);
  const factor = Math.pow(1.05, diff);
  const out: Record<string, number> = {};
  for (const [cls, fee] of Object.entries(BASE_FEES)) out[cls] = Math.round((fee * factor) / 500) * 500;
  return out;
}

const MODES: { mode: PaymentMode; weight: number }[] = [
  { mode: 'UPI', weight: 45 },
  { mode: 'Cash', weight: 25 },
  { mode: 'Bank transfer', weight: 20 },
  { mode: 'Cheque', weight: 7 },
  { mode: 'Card', weight: 3 },
];

function pickMode(r: () => number): PaymentMode {
  let x = r() * 100;
  for (const m of MODES) {
    if (x < m.weight) return m.mode;
    x -= m.weight;
  }
  return 'UPI';
}

function randomDate(r: () => number, from: string, to: string): string {
  const span = Math.max(0, daysBetween(from, to));
  return addDays(from, int(r, 0, span));
}

function splitAmount(r: () => number, total: number, n: number): number[] {
  if (n <= 1) return [total];
  const cuts: number[] = [];
  for (let i = 0; i < n - 1; i++) cuts.push(Math.round((total * (0.25 + r() * 0.5)) / 500) * 500);
  const parts: number[] = [];
  let remaining = total;
  for (const c of cuts) {
    const amt = Math.min(Math.max(500, c), remaining - 500 * (n - parts.length - 1));
    parts.push(amt);
    remaining -= amt;
  }
  parts.push(remaining);
  return parts.filter((p) => p > 0);
}

interface Slot {
  student: Student;
  className: string;
  section: string;
}

/** Deterministic demo data: 1,248 students across classes 1-10, three academic years. */
export function generateSeed(today: string = todayISO()): AppData {
  const r = rng(20261008);
  const currentYear = academicYearFor(today);
  const prevYear = prevAcademicYear(currentYear);
  const nextYear = nextAcademicYear(currentYear);
  const yearStart = academicYearStart(currentYear);
  const yy = String(yearStartOf(currentYear)).slice(2);

  // Section sizes: five sections fixed to the proposal's class-wise example, total 1,248.
  const sections: { label: string; className: string; section: string; size: number; fixed: boolean }[] = [];
  const fixedSizes: Record<string, number> = { '6-A': 42, '6-B': 40, '7-A': 44, '7-B': 43, '8-A': 42 };
  for (const c of CLASSES) {
    for (const s of SECTIONS) {
      const label = `${c}-${s}`;
      sections.push({ label, className: c, section: s, size: fixedSizes[label] ?? int(r, 38, 45), fixed: label in fixedSizes });
    }
  }
  let diff = 1248 - sections.reduce((sum, s) => sum + s.size, 0);
  let guard = 0;
  while (diff !== 0 && guard++ < 1000) {
    const s = sections[guard % sections.length];
    if (s.fixed) continue;
    if (diff > 0 && s.size < 47) {
      s.size++;
      diff--;
    } else if (diff < 0 && s.size > 36) {
      s.size--;
      diff++;
    }
  }

  // Students
  const admissionNos = shuffle(r, Array.from({ length: 1248 }, (_, i) => String(1001 + i)));
  const slots: Slot[] = [];
  const usedNames = new Set<string>();
  let admIndex = 0;
  for (const sec of sections) {
    for (let i = 0; i < sec.size; i++) {
      let name = '';
      for (let tries = 0; tries < 20; tries++) {
        name = `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`;
        if (!usedNames.has(`${sec.label}:${name}`)) break;
      }
      usedNames.add(`${sec.label}:${name}`);
      const last = name.split(' ')[1];
      const parentFirst = pick(r, PARENT_FIRST);
      const student: Student = {
        admissionNo: admissionNos[admIndex++],
        name,
        guardianName: `${parentFirst} ${last}`,
        phone: `9${int(r, 100000000, 999999999)}`,
        email: r() < 0.6 ? `${parentFirst.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com` : '',
      };
      slots.push({ student, className: sec.className, section: sec.section });
    }
  }
  // Rahul Sharma, admission 1001, class 8-A — the proposal's worked example.
  const rahul = slots.find((s) => s.className === '8' && s.section === 'A')!;
  const holder = slots.find((s) => s.student.admissionNo === '1001')!;
  holder.student.admissionNo = rahul.student.admissionNo;
  rahul.student = { admissionNo: '1001', name: 'Rahul Sharma', guardianName: 'Rajesh Sharma', phone: '9876543210', email: 'rajesh.sharma@example.com' };

  const students = slots.map((s) => s.student);
  const feeRecords: FeeRecord[] = [];
  const payments: Payment[] = [];
  const feeStructure: Record<string, Record<string, number>> = {
    [prevYear]: feeStructureFor(prevYear, currentYear),
    [currentYear]: feeStructureFor(currentYear, currentYear),
    [nextYear]: feeStructureFor(nextYear, currentYear),
  };

  // ----- Current year: who has an outstanding balance -----
  const fixedOutstanding: Record<string, number> = { '6-A': 3, '6-B': 4, '7-A': 3, '7-B': 8, '8-A': 11 };
  const remainingOutstanding = 177 - Object.values(fixedOutstanding).reduce((a, b) => a + b, 0);
  const weightOf = (c: string) => (c === '8' ? 3 : c === '7' || c === '9' ? 1.5 : 1);
  const open = sections.filter((s) => !(s.label in fixedOutstanding));
  const weightSum = open.reduce((sum, s) => sum + weightOf(s.className), 0);
  const quota = new Map<string, number>();
  let allocated = 0;
  const remainders: { label: string; frac: number }[] = [];
  for (const s of open) {
    const exact = (remainingOutstanding * weightOf(s.className)) / weightSum;
    const base = Math.floor(exact);
    quota.set(s.label, base);
    allocated += base;
    remainders.push({ label: s.label, frac: exact - base });
  }
  remainders.sort((a, b) => b.frac - a.frac);
  for (let i = 0; allocated < remainingOutstanding; i++, allocated++) quota.set(remainders[i].label, quota.get(remainders[i].label)! + 1);
  for (const [label, n] of Object.entries(fixedOutstanding)) quota.set(label, n);

  const outstandingSlots: Slot[] = [];
  for (const sec of sections) {
    const members = slots.filter((s) => s.className === sec.className && s.section === sec.section);
    const n = quota.get(sec.label) ?? 0;
    let chosen = shuffle(r, members).slice(0, n);
    if (sec.label === '8-A' && !chosen.includes(rahul)) chosen = [rahul, ...chosen.slice(0, n - 1)];
    outstandingSlots.push(...chosen);
  }
  const outstandingSet = new Set(outstandingSlots);

  // Partial (103) vs unpaid (74); Rahul is partially paid.
  let order = shuffle(r, outstandingSlots.filter((s) => s !== rahul));
  const partial = new Set<Slot>([rahul, ...order.slice(0, 102)]);

  // Due dates: 31 overdue, 7 due today, 16 due in 1-3 days, 18 (+Rahul) due in 4-7 days, the rest later.
  const dueDates = new Map<Slot, string>();
  order = shuffle(r, order);
  order.forEach((slot, i) => {
    let due: string;
    if (i < 31) due = addDays(today, -int(r, 2, 45));
    else if (i < 38) due = today;
    else if (i < 54) due = addDays(today, int(r, 1, 3));
    else if (i < 72) due = addDays(today, int(r, 4, 7));
    else due = addDays(today, int(r, 8, 75));
    dueDates.set(slot, due);
  });
  dueDates.set(rahul, addDays(today, 7));

  const termDue = addDays(yearStart, 106); // mid-September
  const paymentWindowEnd = termDue < today ? termDue : today;
  const currentFees = feeStructure[currentYear];

  for (const slot of slots) {
    const id = feeRecordId(currentYear, slot.student.admissionNo);
    const totalFee = currentFees[slot.className];
    const isOutstanding = outstandingSet.has(slot);
    const dueDate = isOutstanding ? dueDates.get(slot)! : termDue;
    feeRecords.push({
      id,
      admissionNo: slot.student.admissionNo,
      academicYear: currentYear,
      className: slot.className,
      section: slot.section,
      feeStructure: `Annual fee ${currentYear}`,
      totalFee,
      dueDate,
    });
    if (slot === rahul) {
      const y = yearStartOf(currentYear);
      for (const [date, amount] of [[`${y}-06-10`, 10000], [`${y}-08-10`, 5000]] as [string, number][]) {
        payments.push({ id: '', feeRecordId: id, date: date > today ? today : date, amount, receiptNo: '', mode: 'UPI', source: 'seed' });
      }
      continue;
    }
    if (!isOutstanding) {
      const n = r() < 0.55 ? 1 : r() < 0.8 ? 2 : 3;
      const parts = splitAmount(r, totalFee, n);
      const dates = parts.map(() => randomDate(r, yearStart, paymentWindowEnd)).sort();
      parts.forEach((amount, i) => payments.push({ id: '', feeRecordId: id, date: dates[i], amount, receiptNo: '', mode: pickMode(r), source: 'seed' }));
    } else if (partial.has(slot)) {
      const paid = Math.min(totalFee - 500, Math.max(500, Math.round((totalFee * (0.2 + r() * 0.6)) / 500) * 500));
      const n = r() < 0.6 ? 1 : 2;
      const parts = splitAmount(r, paid, n);
      const latest = dueDate < today ? dueDate : today;
      const dates = parts.map(() => randomDate(r, yearStart, latest)).sort();
      parts.forEach((amount, i) => payments.push({ id: '', feeRecordId: id, date: dates[i], amount, receiptNo: '', mode: pickMode(r), source: 'seed' }));
    }
  }

  // ----- Previous year: same students one class lower, year closed -----
  const prevStart = academicYearStart(prevYear);
  const prevDue = addDays(prevStart, 106);
  const prevFees = feeStructure[prevYear];
  for (const slot of slots) {
    const cls = String(Number(slot.className) - 1);
    if (!(cls in prevFees) || Number(cls) < 1) continue;
    const id = feeRecordId(prevYear, slot.student.admissionNo);
    const totalFee = prevFees[cls];
    feeRecords.push({ id, admissionNo: slot.student.admissionNo, academicYear: prevYear, className: cls, section: slot.section, feeStructure: `Annual fee ${prevYear}`, totalFee, dueDate: prevDue });
    const x = r();
    const paid = slot === rahul || x < 0.965 ? totalFee : x < 0.985 ? Math.round((totalFee * (0.3 + r() * 0.5)) / 500) * 500 : 0;
    if (paid <= 0) continue;
    const n = r() < 0.5 ? 1 : r() < 0.8 ? 2 : 3;
    const parts = splitAmount(r, paid, n);
    const dates = parts.map(() => randomDate(r, prevStart, addDays(prevStart, 300))).sort();
    parts.forEach((amount, i) => payments.push({ id: '', feeRecordId: id, date: dates[i], amount, receiptNo: '', mode: pickMode(r), source: 'seed' }));
  }

  // ----- Next year: promoted students, fee set, nothing collected yet -----
  const nextStart = academicYearStart(nextYear);
  const nextFees = feeStructure[nextYear];
  for (const slot of slots) {
    const cls = String(Number(slot.className) + 1);
    if (!(cls in nextFees)) continue;
    feeRecords.push({
      id: feeRecordId(nextYear, slot.student.admissionNo),
      admissionNo: slot.student.admissionNo,
      academicYear: nextYear,
      className: cls,
      section: slot.section,
      feeStructure: `Annual fee ${nextYear}`,
      totalFee: nextFees[cls],
      dueDate: addDays(nextStart, 44),
    });
  }

  // Receipt numbers and ids in date order per year.
  const byYear = new Map<string, Payment[]>();
  const recordYear = new Map(feeRecords.map((f) => [f.id, f.academicYear]));
  for (const p of payments) {
    const y = recordYear.get(p.feeRecordId)!;
    const list = byYear.get(y) ?? [];
    list.push(p);
    byYear.set(y, list);
  }
  for (const [y, list] of byYear) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.feeRecordId.localeCompare(b.feeRecordId)));
    const prefix = String(yearStartOf(y)).slice(2);
    list.forEach((p, i) => {
      p.receiptNo = `R${prefix}-${String(i + 1).padStart(5, '0')}`;
      p.id = `pay-${y}-${i + 1}`;
    });
  }
  void yy;

  return {
    version: DATA_VERSION,
    schoolName: DEFAULT_SCHOOL_NAME,
    years: [prevYear, currentYear, nextYear],
    currentYear,
    students,
    feeRecords,
    payments,
    reminders: [],
    imports: [],
    feeStructure,
    seededAt: today,
  };
}

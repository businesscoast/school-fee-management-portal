import { academicYearStart, addDays, formatDate, parseAcademicYear, parseDateLoose } from '../dates';
import { formatINR, parseAmount } from '../money';
import type { SourceKind } from '../types';
import type { Field } from './mapping';
import type { RawTable } from './textTable';

export type RowMode = 'student' | 'receipt';

export interface Issue {
  level: 'error' | 'warning';
  field?: Field;
  message: string;
}

export interface ParsedRow {
  admissionNo?: string;
  name?: string;
  className?: string;
  section?: string;
  totalFee?: number;
  paidAmount?: number;
  balance?: number;
  dueDate?: string;
  paymentDate?: string;
  receiptNo?: string;
  academicYear?: string;
  guardianName?: string;
  phone?: string;
  email?: string;
  feeStructure?: string;
}

export interface ExistingInfo {
  name: string;
  className: string;
  section: string;
  totalFee: number;
  paid: number;
  dueDate: string;
}

export interface ValidationContext {
  existing: Map<string, ExistingInfo>; // by admission number, for the target year
  existingReceipts: Set<string>;
  feeStructure: Record<string, number>; // class -> fee for the target year
  year: string;
  today: string;
  sourceKind: SourceKind;
  rowMode: RowMode;
}

export type RawRow = Partial<Record<Field, string>>;

export interface ExtractedRecord {
  rowIndex: number; // 1-based row within the file body
  raw: RawRow;
  parsed: ParsedRow;
  issues: Issue[];
  confidence: number; // 0..1
  needsReview: boolean;
  match: 'new' | 'existing';
  existing?: ExistingInfo;
  paymentToAdd: number; // amount a successful import would record as a new payment
  decision: 'import' | 'skip';
}

/** Fields shown as editable cells in the review step. */
export const EDITABLE_FIELDS: Field[] = [
  'admissionNo',
  'name',
  'className',
  'section',
  'totalFee',
  'paidAmount',
  'balance',
  'dueDate',
  'paymentDate',
  'receiptNo',
  'guardianName',
  'phone',
  'email',
];

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12' };
const KINDER: Record<string, string> = { lkg: 'LKG', ukg: 'UKG', kg: 'KG', nursery: 'Nursery', nur: 'Nursery', prekg: 'Pre-KG', 'pre-kg': 'Pre-KG', pp1: 'LKG', pp2: 'UKG' };

/** '8', '8-A', '8A', 'VIII A', 'Class 8', 'Std 10 / B', 'LKG' -> { className, section } */
export function normalizeClass(input: string): { className: string; section: string } | null {
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const m = s.match(/^(?:class|std|standard|grade)?\s*\.?\s*([a-z0-9\-]+?)(?:\s*[-/ ]\s*([a-z]))?\s*$/i);
  if (!m) return null;
  let token = m[1].toLowerCase();
  let section = (m[2] ?? '').toUpperCase();
  const glued = token.match(/^(\d{1,2})([a-z])$/);
  if (glued && !section) {
    token = glued[1];
    section = glued[2].toUpperCase();
  }
  let className: string;
  if (/^\d{1,2}$/.test(token)) className = String(Number(token));
  else if (ROMAN[token]) className = ROMAN[token];
  else if (KINDER[token]) className = KINDER[token];
  else return null;
  if (className === '0') return null;
  return { className, section };
}

export function normalizeSection(input: string): string {
  return input
    .trim()
    .replace(/^(sec(tion)?|div(ision)?)\s*\.?\s*/i, '')
    .toUpperCase();
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Bigram Dice similarity on normalised names, 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const set = new Map<string, number>();
    const t = s.replace(/ /g, '');
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      set.set(g, (set.get(g) ?? 0) + 1);
    }
    return set;
  };
  const gx = grams(x);
  const gy = grams(y);
  let overlap = 0;
  for (const [g, n] of gx) overlap += Math.min(n, gy.get(g) ?? 0);
  const total = [...gx.values()].reduce((a, b) => a + b, 0) + [...gy.values()].reduce((a, b) => a + b, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** Convert one source row into field -> raw string, splitting a combined class column. */
export function rowToRaw(row: string[], mapping: Field[]): RawRow {
  const raw: RawRow = {};
  mapping.forEach((field, col) => {
    if (field === 'ignore') return;
    const value = (row[col] ?? '').toString().trim();
    if (field === 'classSection') {
      const parsed = normalizeClass(value);
      if (parsed) {
        if (raw.className === undefined) raw.className = parsed.className;
        if (raw.section === undefined && parsed.section) raw.section = parsed.section;
      } else if (value && raw.className === undefined) {
        raw.className = value;
      }
      return;
    }
    if (raw[field] === undefined || raw[field] === '') raw[field] = value;
  });
  return raw;
}

export function isEmptyRaw(raw: RawRow): boolean {
  return Object.values(raw).every((v) => !v || !v.trim());
}

interface SeenState {
  admissionRows: Map<string, number>;
  receiptRows: Map<string, number>;
  cumulativePaid: Map<string, number>;
}

function baseConfidence(kind: SourceKind): number {
  if (kind === 'image') return 0.8;
  if (kind === 'pdf') return 0.9;
  return 1;
}

export function validateAll(table: RawTable, mapping: Field[], ctx: ValidationContext): ExtractedRecord[] {
  const inputs: { rowIndex: number; raw: RawRow }[] = [];
  table.rows.forEach((row, i) => {
    const raw = rowToRaw(row, mapping);
    if (!isEmptyRaw(raw)) inputs.push({ rowIndex: i + 1, raw });
  });
  return validateRecords(inputs, ctx);
}

/** Validate rows in order; later duplicates are the ones flagged. Keeps prior decisions. */
export function validateRecords(inputs: { rowIndex: number; raw: RawRow; decision?: 'import' | 'skip' }[], ctx: ValidationContext): ExtractedRecord[] {
  const seen: SeenState = { admissionRows: new Map(), receiptRows: new Map(), cumulativePaid: new Map() };
  return inputs.map((input) => validateRecord(input.raw, input.rowIndex, ctx, seen, input.decision));
}

function validateRecord(raw: RawRow, rowIndex: number, ctx: ValidationContext, seen: SeenState, decision?: 'import' | 'skip'): ExtractedRecord {
  const issues: Issue[] = [];
  const parsed: ParsedRow = {};
  const err = (field: Field | undefined, message: string) => issues.push({ level: 'error', field, message });
  const warn = (field: Field | undefined, message: string) => issues.push({ level: 'warning', field, message });
  const get = (f: Field) => (raw[f] ?? '').trim();

  // Admission number
  const admissionNo = get('admissionNo').toUpperCase();
  if (!admissionNo) err('admissionNo', 'Admission number is missing.');
  else {
    parsed.admissionNo = admissionNo;
    const firstRow = seen.admissionRows.get(admissionNo);
    if (firstRow !== undefined && ctx.rowMode === 'student') err('admissionNo', `Admission number ${admissionNo} already appears in row ${firstRow} of this file.`);
    if (firstRow === undefined) seen.admissionRows.set(admissionNo, rowIndex);
  }
  const existing = admissionNo ? ctx.existing.get(admissionNo) : undefined;
  const match: ExtractedRecord['match'] = existing ? 'existing' : 'new';

  // Name
  const name = get('name').replace(/\s+/g, ' ');
  if (name) {
    parsed.name = name;
    if (existing && nameSimilarity(name, existing.name) < 0.8) warn('name', `Name differs from the record on file (${existing.name}).`);
  } else if (existing) {
    parsed.name = existing.name;
  } else {
    err('name', 'Student name is missing for a new student.');
  }

  // Class and section
  const classRaw = get('className');
  const sectionRaw = get('section');
  if (classRaw) {
    const cls = normalizeClass(classRaw);
    if (!cls) err('className', `Class "${classRaw}" is not recognised.`);
    else {
      parsed.className = cls.className;
      parsed.section = sectionRaw ? normalizeSection(sectionRaw) : cls.section;
      if (existing && (existing.className !== cls.className || (parsed.section && existing.section && parsed.section !== existing.section))) {
        warn('className', `Class changes from ${existing.className}-${existing.section} on file to ${cls.className}${parsed.section ? `-${parsed.section}` : ''}.`);
      }
    }
  } else if (existing) {
    parsed.className = existing.className;
    parsed.section = sectionRaw ? normalizeSection(sectionRaw) : existing.section;
  } else {
    err('className', 'Class is required for a new student.');
  }
  if (parsed.className && !(parsed.className in ctx.feeStructure)) {
    warn('className', `Class ${parsed.className} has no fee set in the ${ctx.year} fee structure.`);
  }

  // Total fee
  const totalRaw = get('totalFee');
  if (totalRaw) {
    const v = parseAmount(totalRaw);
    if (v === null) err('totalFee', `Total fee "${totalRaw}" is not a number.`);
    else if (v < 0) err('totalFee', 'Total fee cannot be negative.');
    else parsed.totalFee = v;
  } else if (existing) {
    parsed.totalFee = existing.totalFee;
  } else if (parsed.className && parsed.className in ctx.feeStructure) {
    parsed.totalFee = ctx.feeStructure[parsed.className];
    warn('totalFee', `Total fee not given; using ${formatINR(parsed.totalFee)} from the fee structure for class ${parsed.className}.`);
  } else if (parsed.className) {
    err('totalFee', 'Total fee is missing and the class has no fee structure.');
  }

  // Paid amount
  const paidRaw = get('paidAmount');
  let paid: number | undefined;
  if (paidRaw) {
    const v = parseAmount(paidRaw);
    if (v === null) err('paidAmount', `Amount paid "${paidRaw}" is not a number.`);
    else if (v < 0) err('paidAmount', 'Amount paid cannot be negative.');
    else paid = v;
  } else if (ctx.rowMode === 'receipt') {
    err('paidAmount', 'Receipt amount is missing.');
  }
  if (paid !== undefined) parsed.paidAmount = paid;

  const recordedPaid = existing?.paid ?? 0;
  let paymentToAdd = 0;
  if (paid !== undefined) {
    if (ctx.rowMode === 'student') {
      if (parsed.totalFee !== undefined && paid > parsed.totalFee) err('paidAmount', `Paid ${formatINR(paid)} exceeds the total fee ${formatINR(parsed.totalFee)}.`);
      if (existing && paid < recordedPaid) warn('paidAmount', `File shows ${formatINR(paid)} paid but ${formatINR(recordedPaid)} is already recorded; existing payments are kept.`);
      paymentToAdd = Math.max(0, paid - recordedPaid);
    } else {
      const before = seen.cumulativePaid.get(admissionNo) ?? recordedPaid;
      if (parsed.totalFee !== undefined && before + paid > parsed.totalFee) err('paidAmount', `This receipt would take paid to ${formatINR(before + paid)}, above the total fee ${formatINR(parsed.totalFee)}.`);
      paymentToAdd = paid;
      seen.cumulativePaid.set(admissionNo, before + paid);
    }
  }

  // Balance
  const balanceRaw = get('balance');
  if (balanceRaw) {
    const v = parseAmount(balanceRaw);
    if (v === null) warn('balance', `Balance "${balanceRaw}" is not a number.`);
    else {
      parsed.balance = v;
      if (ctx.rowMode === 'student' && parsed.totalFee !== undefined && paid !== undefined && Math.abs(v - (parsed.totalFee - paid)) > 1) {
        warn('balance', `Balance ${formatINR(v)} does not match total minus paid (${formatINR(parsed.totalFee - paid)}).`);
      }
    }
  }

  // Due date
  const dueRaw = get('dueDate');
  if (dueRaw) {
    const d = parseDateLoose(dueRaw);
    if (!d) err('dueDate', `Due date "${dueRaw}" is not a valid date.`);
    else parsed.dueDate = d;
  } else if (existing) {
    parsed.dueDate = existing.dueDate;
  } else {
    parsed.dueDate = addDays(academicYearStart(ctx.year), 44);
    warn('dueDate', `Due date not given; using ${formatDate(parsed.dueDate)}.`);
  }

  // Payment date
  const payDateRaw = get('paymentDate');
  if (payDateRaw) {
    const d = parseDateLoose(payDateRaw);
    if (!d) warn('paymentDate', `Payment date "${payDateRaw}" was not recognised; today's date will be used.`);
    else {
      parsed.paymentDate = d;
      if (d > ctx.today) warn('paymentDate', `Payment date ${formatDate(d)} is in the future.`);
    }
  }

  // Receipt number
  const receiptNo = get('receiptNo').toUpperCase();
  if (receiptNo) {
    parsed.receiptNo = receiptNo;
    const firstRow = seen.receiptRows.get(receiptNo);
    if (firstRow !== undefined) err('receiptNo', `Receipt number ${receiptNo} already appears in row ${firstRow} of this file.`);
    else seen.receiptRows.set(receiptNo, rowIndex);
    if (paymentToAdd > 0 && ctx.existingReceipts.has(receiptNo)) err('receiptNo', `Receipt number ${receiptNo} is already recorded against another payment.`);
  }

  // Contact details
  const guardian = get('guardianName');
  if (guardian) parsed.guardianName = guardian;
  const phoneRaw = get('phone');
  if (phoneRaw) {
    const digits = normalizePhone(phoneRaw);
    if (digits.length !== 10) warn('phone', `Mobile number "${phoneRaw}" does not look like a 10-digit number.`);
    parsed.phone = digits.length === 10 ? digits : phoneRaw;
  }
  const email = get('email');
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warn('email', `Email "${email}" does not look valid.`);
    parsed.email = email.toLowerCase();
  }
  const yearRaw = get('academicYear');
  if (yearRaw) {
    const y = parseAcademicYear(yearRaw);
    if (y && y !== ctx.year) warn('academicYear', `Row is marked ${y} but it is being imported into ${ctx.year}.`);
    if (y) parsed.academicYear = y;
  }
  const structure = get('feeStructure');
  if (structure) parsed.feeStructure = structure;

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;
  let confidence = baseConfidence(ctx.sourceKind) - warnings * 0.15;
  if (errors > 0) confidence = Math.min(confidence, 0.4);
  confidence = Math.max(0, Math.round(confidence * 100) / 100);
  const needsReview = errors > 0 || confidence < 0.8;

  return {
    rowIndex,
    raw,
    parsed,
    issues,
    confidence,
    needsReview,
    match,
    existing,
    paymentToAdd: errors > 0 ? 0 : paymentToAdd,
    decision: decision ?? 'import',
  };
}

export function hasErrors(record: ExtractedRecord): boolean {
  return record.issues.some((i) => i.level === 'error');
}

export function importStats(records: ExtractedRecord[]) {
  const identified = records.length;
  const review = records.filter((r) => r.needsReview).length;
  const skipped = records.filter((r) => r.decision === 'skip').length;
  const blocked = records.filter((r) => r.decision === 'import' && hasErrors(r)).length;
  const importable = records.filter((r) => r.decision === 'import' && !hasErrors(r)).length;
  return { identified, review, ready: identified - review, skipped, blocked, importable };
}

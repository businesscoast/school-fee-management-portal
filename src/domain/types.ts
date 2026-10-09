export type AcademicYear = string; // e.g. '2026-27'

export interface Student {
  admissionNo: string;
  name: string;
  guardianName: string;
  phone: string;
  email: string;
}

export interface FeeRecord {
  id: string; // `${academicYear}:${admissionNo}`
  admissionNo: string;
  academicYear: AcademicYear;
  className: string; // '1'..'12', 'LKG', 'UKG', 'Nursery'
  section: string; // 'A'
  feeStructure: string; // label of the fee plan applied
  totalFee: number;
  dueDate: string; // YYYY-MM-DD
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank transfer' | 'Cheque' | 'Card' | 'Imported';
export const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank transfer', 'Cheque', 'Card'];

export interface Payment {
  id: string;
  feeRecordId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  receiptNo: string;
  mode: PaymentMode;
  source: 'manual' | 'import' | 'seed';
  note?: string;
}

export type Channel = 'SMS' | 'WhatsApp' | 'Email';

export interface ReminderRecipient {
  admissionNo: string;
  name: string;
  classLabel: string;
  outstanding: number;
  dueDate: string;
  to: string;
}

export interface Reminder {
  id: string;
  sentAt: string; // ISO datetime
  channel: Channel;
  academicYear: AcademicYear;
  message: string; // template with placeholders
  recipients: ReminderRecipient[];
}

export type SourceKind = 'csv' | 'xlsx' | 'pdf' | 'image';

export interface ImportBatch {
  id: string;
  at: string;
  fileName: string;
  sourceKind: SourceKind;
  academicYear: AcademicYear;
  identified: number;
  imported: number;
  reviewed: number;
  skipped: number;
  studentsCreated: number;
  paymentsAdded: number;
}

export interface AppData {
  version: number;
  schoolName: string;
  years: AcademicYear[];
  currentYear: AcademicYear;
  students: Student[];
  feeRecords: FeeRecord[];
  payments: Payment[];
  reminders: Reminder[];
  imports: ImportBatch[];
  feeStructure: Record<AcademicYear, Record<string, number>>; // year -> class -> annual fee
  seededAt: string;
}

export type PayStatus = 'Fully Paid' | 'Partially Paid' | 'Unpaid';
export type DisplayStatus = PayStatus | 'Overdue';
export const DISPLAY_STATUSES: DisplayStatus[] = ['Fully Paid', 'Partially Paid', 'Unpaid', 'Overdue'];

export type DueBucket = 'overdue' | 'today' | 'within3' | 'within7' | 'later' | 'none';

export interface FeeView {
  student: Student;
  record: FeeRecord;
  payments: Payment[];
  paid: number;
  outstanding: number;
  payStatus: PayStatus;
  status: DisplayStatus;
  daysToDue: number; // negative when the due date has passed
  bucket: DueBucket;
  classLabel: string; // '8-A'
}

export function feeRecordId(year: AcademicYear, admissionNo: string): string {
  return `${year}:${admissionNo}`;
}

export function classLabel(className: string, section: string): string {
  return section ? `${className}-${section}` : className;
}

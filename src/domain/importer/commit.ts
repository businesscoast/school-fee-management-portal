import { newId } from '../ids';
import type { AppData, FeeRecord, ImportBatch, Payment, SourceKind, Student } from '../types';
import { feeRecordId } from '../types';
import type { ExtractedRecord, RowMode } from './validate';
import { hasErrors } from './validate';

export interface CommitOptions {
  year: string;
  fileName: string;
  sourceKind: SourceKind;
  today: string;
  now: string;
  rowMode: RowMode;
}

/** Apply reviewed records to the data set. Pure: returns a new AppData and the batch summary. */
export function applyImport(data: AppData, records: ExtractedRecord[], opts: CommitOptions): { data: AppData; batch: ImportBatch } {
  const students = new Map(data.students.map((s) => [s.admissionNo, { ...s }]));
  const feeRecords = new Map(data.feeRecords.map((r) => [r.id, { ...r }]));
  const payments = data.payments.slice();
  const paidByRecord = new Map<string, number>();
  for (const p of payments) paidByRecord.set(p.feeRecordId, (paidByRecord.get(p.feeRecordId) ?? 0) + p.amount);

  const batchId = newId('imp');
  const batch: ImportBatch = {
    id: batchId,
    at: opts.now,
    fileName: opts.fileName,
    sourceKind: opts.sourceKind,
    academicYear: opts.year,
    identified: records.length,
    imported: 0,
    reviewed: 0,
    skipped: 0,
    studentsCreated: 0,
    paymentsAdded: 0,
  };
  let seq = 0;

  for (const rec of records) {
    if (rec.decision === 'skip' || hasErrors(rec)) {
      batch.skipped++;
      continue;
    }
    const p = rec.parsed;
    if (!p.admissionNo || !p.name || !p.className || p.totalFee === undefined || !p.dueDate) {
      batch.skipped++;
      continue;
    }
    let student = students.get(p.admissionNo);
    if (!student) {
      student = { admissionNo: p.admissionNo, name: p.name, guardianName: '', phone: '', email: '' };
      students.set(p.admissionNo, student);
      batch.studentsCreated++;
    }
    student.name = p.name;
    if (p.guardianName) student.guardianName = p.guardianName;
    if (p.phone) student.phone = p.phone;
    if (p.email) student.email = p.email;

    const id = feeRecordId(opts.year, p.admissionNo);
    let record = feeRecords.get(id);
    if (!record) {
      record = {
        id,
        admissionNo: p.admissionNo,
        academicYear: opts.year,
        className: p.className,
        section: p.section ?? '',
        feeStructure: p.feeStructure ?? `Annual fee ${opts.year}`,
        totalFee: p.totalFee,
        dueDate: p.dueDate,
      };
      feeRecords.set(id, record);
    } else {
      record.className = p.className;
      if (p.section) record.section = p.section;
      record.totalFee = p.totalFee;
      record.dueDate = p.dueDate;
      if (p.feeStructure) record.feeStructure = p.feeStructure;
    }

    const amount = opts.rowMode === 'receipt' ? (p.paidAmount ?? 0) : p.paidAmount === undefined ? 0 : Math.max(0, p.paidAmount - (paidByRecord.get(id) ?? 0));
    if (amount > 0) {
      seq++;
      const payment: Payment = {
        id: newId('pay'),
        feeRecordId: id,
        date: p.paymentDate ?? opts.today,
        amount,
        receiptNo: p.receiptNo ?? `IMP-${batchId.slice(-6).toUpperCase()}-${String(seq).padStart(3, '0')}`,
        mode: 'Imported',
        source: 'import',
        note: `Imported from ${opts.fileName}`,
      };
      payments.push(payment);
      paidByRecord.set(id, (paidByRecord.get(id) ?? 0) + amount);
      batch.paymentsAdded++;
    }
    batch.imported++;
    if (rec.needsReview) batch.reviewed++;
  }

  const next: AppData = {
    ...data,
    students: [...students.values()] as Student[],
    feeRecords: [...feeRecords.values()] as FeeRecord[],
    payments,
    imports: [batch, ...data.imports],
  };
  return { data: next, batch };
}

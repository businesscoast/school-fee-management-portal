import { describe, expect, it } from 'vitest';
import { guessField, guessMapping } from '../src/domain/importer/mapping';

describe('column mapping', () => {
  it('recognises common register headers', () => {
    expect(guessField('Admission No')).toBe('admissionNo');
    expect(guessField('Adm. No.')).toBe('admissionNo');
    expect(guessField('Student Name')).toBe('name');
    expect(guessField("Father's Name")).toBe('guardianName');
    expect(guessField('Class')).toBe('className');
    expect(guessField('Section')).toBe('section');
    expect(guessField('Class & Section')).toBe('classSection');
    expect(guessField('Total Fee')).toBe('totalFee');
    expect(guessField('Annual Fee')).toBe('totalFee');
    expect(guessField('Amount Paid')).toBe('paidAmount');
    expect(guessField('Fees Collected')).toBe('paidAmount');
    expect(guessField('Balance')).toBe('balance');
    expect(guessField('Due Amount')).toBe('balance');
    expect(guessField('Due Date')).toBe('dueDate');
    expect(guessField('Payment Date')).toBe('paymentDate');
    expect(guessField('Receipt No')).toBe('receiptNo');
    expect(guessField('Mobile')).toBe('phone');
    expect(guessField('Email')).toBe('email');
    expect(guessField('Academic Year')).toBe('academicYear');
    expect(guessField('Fee Structure')).toBe('feeStructure');
    expect(guessField('Sl No')).toBe('ignore');
    expect(guessField('Remarks')).toBe('ignore');
  });
  it('uses each field once and detects combined class values', () => {
    const headers = ['Adm No', 'Name', 'Class', 'Fee', 'Paid', 'Paid'];
    const rows = [['1001', 'Rahul', '8-A', '25000', '15000', '15000']];
    expect(guessMapping(headers, rows)).toEqual(['admissionNo', 'name', 'classSection', 'totalFee', 'paidAmount', 'ignore']);
  });
});

import { describe, expect, it } from 'vitest';
import { displayStatus, dueBucket, paymentStatus } from '../src/domain/status';

describe('payment status', () => {
  it('derives status from amounts', () => {
    expect(paymentStatus(25000, 25000)).toBe('Fully Paid');
    expect(paymentStatus(25000, 15000)).toBe('Partially Paid');
    expect(paymentStatus(25000, 0)).toBe('Unpaid');
  });
  it('buckets due dates relative to today', () => {
    const today = '2026-10-08';
    expect(dueBucket(0, '2026-09-01', today)).toBe('none');
    expect(dueBucket(10000, '2026-09-30', today)).toBe('overdue');
    expect(dueBucket(10000, '2026-10-08', today)).toBe('today');
    expect(dueBucket(10000, '2026-10-11', today)).toBe('within3');
    expect(dueBucket(10000, '2026-10-15', today)).toBe('within7');
    expect(dueBucket(10000, '2026-11-01', today)).toBe('later');
  });
  it('shows Overdue only when money is still due after the date', () => {
    expect(displayStatus('Partially Paid', 'overdue')).toBe('Overdue');
    expect(displayStatus('Unpaid', 'overdue')).toBe('Overdue');
    expect(displayStatus('Partially Paid', 'within3')).toBe('Partially Paid');
    expect(displayStatus('Fully Paid', 'none')).toBe('Fully Paid');
  });
});

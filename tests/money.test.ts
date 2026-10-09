import { describe, expect, it } from 'vitest';
import { formatINR, formatINRCompact, parseAmount } from '../src/domain/money';

describe('money', () => {
  it('formats with Indian grouping', () => {
    expect(formatINR(5000000)).toBe('₹50,00,000');
    expect(formatINR(640000)).toBe('₹6,40,000');
    expect(formatINR(25000)).toBe('₹25,000');
    expect(formatINR(999)).toBe('₹999');
  });
  it('formats compact headlines', () => {
    expect(formatINRCompact(640000)).toBe('₹6.4L');
    expect(formatINRCompact(27000000)).toBe('₹2.7Cr');
    expect(formatINRCompact(18000)).toBe('₹18k');
    expect(formatINRCompact(950)).toBe('₹950');
  });
  it('parses register amounts', () => {
    expect(parseAmount('₹25,000')).toBe(25000);
    expect(parseAmount('Rs. 25,000/-')).toBe(25000);
    expect(parseAmount('25000.50')).toBe(25000.5);
    expect(parseAmount('(500)')).toBe(-500);
    expect(parseAmount('Twenty thousand')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });
});

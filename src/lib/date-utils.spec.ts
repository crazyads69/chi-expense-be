import { parseMonth, getMonthBoundaries, nowISO } from './date-utils';

describe('date-utils', () => {
  describe('parseMonth', () => {
    it('returns provided month when valid', () => {
      expect(parseMonth('2026-04')).toBe('2026-04');
      expect(parseMonth('2023-12')).toBe('2023-12');
    });

    it('returns current month when no input', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(parseMonth()).toBe(expected);
    });

    it('throws for invalid format', () => {
      expect(() => parseMonth('04-2026')).toThrow('Invalid month format');
      expect(() => parseMonth('2026-4')).toThrow('Invalid month format');
      expect(() => parseMonth('not-a-month')).toThrow('Invalid month format');
      expect(() => parseMonth('')).toThrow('Invalid month format');
      expect(() => parseMonth('2026-13')).toThrow('Invalid month format');
      expect(() => parseMonth('2026-00')).toThrow('Invalid month format');
    });
  });

  describe('getMonthBoundaries', () => {
    it('returns correct start and end for a month', () => {
      const { start, end } = getMonthBoundaries('2026-04');

      expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('handles year rollover', () => {
      const { start, end } = getMonthBoundaries('2026-12');

      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('nowISO', () => {
    it('returns a valid ISO string', () => {
      const result = nowISO();
      expect(() => new Date(result)).not.toThrow();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

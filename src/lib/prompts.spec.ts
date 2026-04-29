import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './prompts';
import { MERCHANT_CATEGORY_MAP } from './merchant-table';

describe('Prompts', () => {
  describe('USER_PROMPT_TEMPLATE', () => {
    it('should wrap message in delimiters', () => {
      const result = USER_PROMPT_TEMPLATE('cà phê 35k');

      expect(result).toContain('<tin_nhắn>');
      expect(result).toContain('cà phê 35k');
      expect(result).toContain('</tin_nhắn>');
    });

    it('should handle empty string', () => {
      const result = USER_PROMPT_TEMPLATE('');

      expect(result).toContain('<tin_nhắn>');
      expect(result).toContain('</tin_nhắn>');
    });

    it('should preserve Vietnamese text', () => {
      const result = USER_PROMPT_TEMPLATE('đồ ăn vặt 20k');

      expect(result).toContain('đồ ăn vặt 20k');
    });
  });

  describe('SYSTEM_PROMPT', () => {
    it('should be a non-empty string with instructions', () => {
      expect(typeof SYSTEM_PROMPT).toBe('string');
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('should mention JSON format', () => {
      expect(SYSTEM_PROMPT).toContain('JSON');
    });

    it('should list expense categories', () => {
      expect(SYSTEM_PROMPT).toContain('Ăn uống');
      expect(SYSTEM_PROMPT).toContain('Di chuyển');
      expect(SYSTEM_PROMPT).toContain('Mua sắm');
      expect(SYSTEM_PROMPT).toContain('Giải trí');
      expect(SYSTEM_PROMPT).toContain('Hóa đơn');
      expect(SYSTEM_PROMPT).toContain('Sức khỏe');
      expect(SYSTEM_PROMPT).toContain('Giáo dục');
      expect(SYSTEM_PROMPT).toContain('Khác');
    });
  });
});

describe('MERCHANT_CATEGORY_MAP', () => {
  it('should map grab to Di chuyển', () => {
    expect(MERCHANT_CATEGORY_MAP.get('grab')).toBe('Di chuyển');
  });

  it('should map cà phê to Ăn uống', () => {
    expect(MERCHANT_CATEGORY_MAP.get('cà phê')).toBe('Ăn uống');
  });

  it('should be case-sensitive (map keys are lowercase)', () => {
    expect(MERCHANT_CATEGORY_MAP.get('GRAB')).toBeUndefined();
    expect(MERCHANT_CATEGORY_MAP.get('Cà Phê')).toBeUndefined();
  });

  it('should have no empty keys', () => {
    for (const [key] of MERCHANT_CATEGORY_MAP) {
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('should have valid categories as values', () => {
    const validCategories = [
      'Ăn uống',
      'Di chuyển',
      'Mua sắm',
      'Giải trí',
      'Hóa đơn',
      'Sức khỏe',
      'Giáo dục',
      'Khác',
    ];

    for (const [, value] of MERCHANT_CATEGORY_MAP) {
      expect(validCategories).toContain(value);
    }
  });
});

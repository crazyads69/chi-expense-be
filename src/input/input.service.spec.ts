import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InputService } from './input.service';
import { DRIZZLE } from '../db/db-token';
import { testDb } from '../../test/helpers/setup';
import { transactions, user } from '../db/schema';
import { eq } from 'drizzle-orm';

// Mock OpenAI module
jest.mock('../lib/openrouter', () => ({
  getOpenAIClient: jest.fn(),
}));

import { getOpenAIClient } from '../lib/openrouter';

describe('InputService', () => {
  let service: InputService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new InputService();
  });

  afterEach(async () => {
    await testDb
      .delete(transactions)
      .where(eq(transactions.userId, 'test-user'));
    await testDb.delete(user).where(eq(user.id, 'test-user'));
  });

  const mockOpenAIResponse = (content: string) => {
    (getOpenAIClient as jest.Mock).mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content } }],
          }),
        },
      },
    });
  };

  const mockOpenAIError = (error: Error) => {
    (getOpenAIClient as jest.Mock).mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(error),
        },
      },
    });
  };

  describe('parseText', () => {
    it('should return local parse when merchant map matches', async () => {
      const result = await service.parseText('test-user', 'grab 35k');

      expect(result.amount).toBe(35000);
      expect(result.category).toBe('Di chuyển');
      expect(getOpenAIClient).not.toHaveBeenCalled();
    });

    it('should return parsed JSON on LLM success', async () => {
      mockOpenAIResponse(
        '{"amount": 50000, "merchant": "Cà phê sữa", "category": "Ăn uống"}',
      );

      const result = await service.parseText('test-user', 'some message');

      expect(result.amount).toBe(50000);
      expect(result.merchant).toBe('Cà phê sữa');
      expect(result.category).toBe('Ăn uống');
    });

    it('should throw 502 when LLM response has no JSON', async () => {
      mockOpenAIResponse('No JSON here');

      await expect(service.parseText('test-user', 'test')).rejects.toThrow(
        HttpException,
      );

      try {
        await service.parseText('test-user', 'test');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.BAD_GATEWAY,
        );
      }
    });

    it('should throw 502 when LLM returns invalid JSON', async () => {
      mockOpenAIResponse('{invalid}');

      try {
        await service.parseText('test-user', 'test');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.BAD_GATEWAY,
        );
      }
    });

    it('should throw 503 on OpenAI API timeout error', async () => {
      mockOpenAIError(new Error('timeout'));

      try {
        await service.parseText('test-user', 'test');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should throw 503 on OpenAI network error', async () => {
      mockOpenAIError(new Error('network error'));

      try {
        await service.parseText('test-user', 'test');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should fallback to local extraction on partial LLM JSON', async () => {
      mockOpenAIResponse('{"amount": 100000}');

      const result = await service.parseText('test-user', 'test');

      expect(result.amount).toBe(100000);
      expect(result.category).toBe('Khác');
    });
  });

  describe('parseImage', () => {
    it('should return parsed JSON on LLM success', async () => {
      mockOpenAIResponse(
        '{"amount": 75000, "merchant": "Receipt Shop", "category": "Mua sắm"}',
      );

      const result = await service.parseImage(
        'test-user',
        'data:image/jpeg;base64,abc123',
      );

      expect(result.amount).toBe(75000);
      expect(result.merchant).toBe('Receipt Shop');
      expect(result.category).toBe('Mua sắm');
    });

    it('should throw 503 on LLM API error', async () => {
      mockOpenAIError(new Error('timeout'));

      try {
        await service.parseImage('test-user', 'data:image/jpeg;base64,abc123');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    });
  });

  describe('Utility methods', () => {
    it('parseAmount: should handle Vietnamese formats', () => {
      expect((service as any).parseAmount('35k')).toBe(35000);
      expect((service as any).parseAmount('50 nghìn')).toBe(50000);
      expect((service as any).parseAmount('100.5k')).toBe(100500);
      expect((service as any).parseAmount('100,000')).toBe(100000);
      expect((service as any).parseAmount('200,000 vnd')).toBe(200000);
      expect((service as any).parseAmount('abc')).toBe(0);
      expect((service as any).parseAmount('0')).toBe(0);
      expect((service as any).parseAmount('')).toBe(0);
    });

    it('parseAmount: should respect max message length', () => {
      const longMessage = 'a'.repeat(501);
      expect((service as any).parseAmount(longMessage)).toBe(0);
    });

    it('lookupMerchant: should match keywords to categories', () => {
      expect((service as any).lookupMerchant('đi grab')).toBe('Di chuyển');
      expect((service as any).lookupMerchant('uống cà phê')).toBe('Ăn uống');
      expect((service as any).lookupMerchant('GRAB')).toBe('Di chuyển');
      expect((service as any).lookupMerchant('nothing')).toBeNull();
    });

    it('extractMerchant: should remove amounts and currency words', () => {
      expect((service as any).extractMerchant('cà phê 35k')).toBe('cà phê');
      expect((service as any).extractMerchant('Xăng 50 nghìn đồng')).toBe(
        'Xăng',
      );
      expect((service as any).extractMerchant('12345')).toBe('Unknown');
    });

    it('extractMerchant: should truncate to 50 chars', () => {
      const longName = 'a'.repeat(60);
      expect((service as any).extractMerchant(longName)).toHaveLength(50);
    });

    it('sanitizeUserMessage: should strip injection characters', () => {
      expect((service as any).sanitizeUserMessage('hello {world}')).toBe(
        'hello world',
      );
      expect((service as any).sanitizeUserMessage('test [1, 2]')).toBe(
        'test 1, 2',
      );
      expect((service as any).sanitizeUserMessage('code: `value`')).toBe(
        'code: value',
      );
      expect((service as any).sanitizeUserMessage('"""quoted"""')).toBe(
        '"quoted"',
      );
      expect((service as any).sanitizeUserMessage('cà phê sữa đá')).toBe(
        'cà phê sữa đá',
      );
    });

    it('sanitizeUserMessage: should strip control characters', () => {
      expect((service as any).sanitizeUserMessage('test\x00\x01')).toBe(
        'test',
      );
    });
  });
});

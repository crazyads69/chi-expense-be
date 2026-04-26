import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

// Mock Redis module
jest.mock('../lib/redis', () => ({
  getRatelimitClient: jest.fn(),
}));

import { getRatelimitClient } from '../lib/redis';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitGuard],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
  });

  const createMockExecutionContext = (
    user?: { id: string },
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  describe('canActivate', () => {
    it('should return true for authenticated user within rate limit', async () => {
      (getRatelimitClient as jest.Mock).mockReturnValue({
        limit: jest.fn().mockResolvedValue({ success: true }),
      });

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(getRatelimitClient).toHaveBeenCalled();
      expect(getRatelimitClient().limit).toHaveBeenCalledWith(
        'ratelimit_user-1',
      );
    });

    it('should throw 401 for unauthenticated user', async () => {
      const context = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.UNAUTHORIZED,
        );
        expect((error as HttpException).message).toBe(
          'Authentication required',
        );
      }
    });

    it('should throw 429 when rate limit exceeded', async () => {
      (getRatelimitClient as jest.Mock).mockReturnValue({
        limit: jest.fn().mockResolvedValue({ success: false }),
      });

      const context = createMockExecutionContext({ id: 'user-1' });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        expect((error as HttpException).message).toBe('Rate limit exceeded');
      }
    });
  });
});

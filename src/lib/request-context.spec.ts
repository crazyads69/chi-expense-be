import { requestContext } from './request-context';

describe('requestContext', () => {
  it('should store and retrieve context', () => {
    const ctx = { requestId: 'test-123', startTime: Date.now() };

    requestContext.run(ctx, () => {
      expect(requestContext.get()).toEqual(ctx);
      expect(requestContext.getRequestId()).toBe('test-123');
    });
  });

  it('should return undefined outside of context', () => {
    expect(requestContext.get()).toBeUndefined();
    expect(requestContext.getRequestId()).toBeUndefined();
  });

  it('should isolate contexts', () => {
    const ctx1 = { requestId: 'req-1', startTime: Date.now() };
    const ctx2 = { requestId: 'req-2', startTime: Date.now() };

    requestContext.run(ctx1, () => {
      expect(requestContext.getRequestId()).toBe('req-1');

      requestContext.run(ctx2, () => {
        expect(requestContext.getRequestId()).toBe('req-2');
      });

      expect(requestContext.getRequestId()).toBe('req-1');
    });
  });
});

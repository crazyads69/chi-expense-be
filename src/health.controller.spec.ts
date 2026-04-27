import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DRIZZLE } from './db/db-token';
import { ShutdownService } from './lib/shutdown.service';

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => jest.fn(),
}));

jest.mock('./lib/redis', () => ({
  getRedisClient: jest.fn(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
  })),
}));

const mockDb = {
  get: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        ShutdownService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('should return ok when all dependencies are healthy', async () => {
    mockDb.get.mockResolvedValue({});
    const result = await controller.health();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toBeDefined();
  });

  it('should throw 503 when database is down', async () => {
    mockDb.get.mockRejectedValue(new Error('DB connection failed'));

    try {
      await controller.health();
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as any).getStatus()).toBe(503);
    }
  });

  it('should throw 503 when shutting down', async () => {
    const shutdownService = controller['shutdownService'] as ShutdownService;
    shutdownService['shuttingDown'] = true;

    await expect(controller.health()).rejects.toThrow(
      'Service is shutting down',
    );
  });
});

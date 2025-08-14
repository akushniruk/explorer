import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { YellowApiService } from '../yellow-api.service';
import workerCfg from '../worker.config';
import { ConfigModule } from '@nestjs/config';

describe('HealthService', () => {
  let service: HealthService;
  let yellowApiService: jest.Mocked<YellowApiService>;

  const mockConfig = {
    healthCheckIntervalMs: 30000,
  };

  const mockYellowApiService = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(workerCfg)],
      providers: [
        HealthService,
        {
          provide: YellowApiService,
          useValue: mockYellowApiService,
        },
        {
          provide: workerCfg.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    yellowApiService = module.get(YellowApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when ping succeeds', async () => {
      yellowApiService.ping.mockResolvedValue(undefined);

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockYellowApiService.ping).toHaveBeenCalledTimes(1);
    });

    it('should return down status when ping fails', async () => {
      mockYellowApiService.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await service.check();

      expect(result.status).toBe('down');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockYellowApiService.ping).toHaveBeenCalledTimes(1);
    });
  });
});

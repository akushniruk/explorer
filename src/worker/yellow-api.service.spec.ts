import { Test, TestingModule } from '@nestjs/testing';
import { YellowApiService } from './yellow-api.service';
import workerCfg from './worker.config';
import { ConfigModule } from '@nestjs/config';

describe('YellowApiService', () => {
  let service: YellowApiService;

  const mockConfig = {
    wsUrl: 'ws://localhost:8080',
    wsReconnectBaseMs: 1000,
    wsReconnectMaxMs: 60000,
    wsRequestTimeoutMs: 5000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(workerCfg)],
      providers: [
        YellowApiService,
        {
          provide: workerCfg.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<YellowApiService>(YellowApiService);

    // Mock WebSocket to prevent actual connections during tests
    jest.spyOn(service as any, 'connect').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('waitUntilOpen', () => {
    it('should resolve immediately if WebSocket is already open', async () => {
      jest.spyOn(service as any, 'isOpen').mockReturnValue(true);

      await expect(service.waitUntilOpen(1000)).resolves.toBeUndefined();
    });

    it('should timeout if WebSocket does not open in time', async () => {
      jest.spyOn(service as any, 'isOpen').mockReturnValue(false);

      await expect(service.waitUntilOpen(100)).rejects.toThrow('WS_NOT_CONNECTED');
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up resources properly', () => {
      const mockRejectAllPending = jest
        .spyOn(service as any, 'rejectAllPending')
        .mockImplementation(() => {});

      // Mock WebSocket instance
      const mockWs = {
        removeAllListeners: jest.fn(),
        terminate: jest.fn(),
      };

      (service as any).ws = mockWs;

      service.onModuleDestroy();

      expect(mockRejectAllPending).toHaveBeenCalledWith(new Error('WS_SHUTTING_DOWN'));
      expect(mockWs.removeAllListeners).toHaveBeenCalled();
      expect(mockWs.terminate).toHaveBeenCalled();
    });

    it('should handle cleanup gracefully when WebSocket is undefined', () => {
      const mockRejectAllPending = jest
        .spyOn(service as any, 'rejectAllPending')
        .mockImplementation(() => {});

      (service as any).ws = undefined;

      expect(() => service.onModuleDestroy()).not.toThrow();
      expect(mockRejectAllPending).toHaveBeenCalledWith(new Error('WS_SHUTTING_DOWN'));
    });
  });

  describe('loosePeek', () => {
    it('should extract method and requestId from valid message', () => {
      const validMessage = JSON.stringify({
        res: [123, 'get_channels', {}, Date.now()],
        sig: ['signature'],
      });

      const result = (service as any).loosePeek(validMessage);

      expect(result.requestId).toBe(123);
      expect(result.method).toBe('get_channels');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidMessage = 'invalid json';

      const result = (service as any).loosePeek(invalidMessage);

      expect(result.requestId).toBeUndefined();
      expect(result.method).toBeUndefined();
    });

    it('should handle malformed message structure', () => {
      const malformedMessage = JSON.stringify({
        res: 'not an array',
      });

      const result = (service as any).loosePeek(malformedMessage);

      expect(result.requestId).toBeUndefined();
      expect(result.method).toBeUndefined();
    });
  });

  describe('makeLooseResponse', () => {
    it('should create loose response from raw message', () => {
      const rawMessage = JSON.stringify({
        res: [123, 'get_channels', [{ channelId: 'test' }], Date.now()],
      });

      const result = (service as any).makeLooseResponse('get_channels', rawMessage, 123);

      expect(result.method).toBe('get_channels');
      expect(result.requestId).toBe(123);
      expect(result.params).toEqual([{ channelId: 'test' }]);
    });

    it('should handle get_app_sessions nested array format', () => {
      const rawMessage = JSON.stringify({
        res: [123, 'get_app_sessions', [[{ sessionId: 'test' }]], Date.now()],
      });

      const result = (service as any).makeLooseResponse('get_app_sessions', rawMessage, 123);

      expect(result.method).toBe('get_app_sessions');
      expect(result.requestId).toBe(123);
      expect(result.params).toEqual([{ sessionId: 'test' }]);
    });
  });

  describe('rejectAllPending', () => {
    it('should reject all pending requests with given error', () => {
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      const mockTimeout = setTimeout(() => {}, 1000);

      (service as any).pendingRequests.set(1, {
        expected: new Set(['get_channels']),
        resolve: mockResolve,
        reject: mockReject,
        timeout: mockTimeout,
      });

      const error = new Error('Test error');

      (service as any).rejectAllPending(error);

      expect(mockReject).toHaveBeenCalledWith(error);
      expect((service as any).pendingRequests.size).toBe(0);
    });
  });
});

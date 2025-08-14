import { Test, TestingModule } from '@nestjs/testing';
import { VersionService } from './version.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('VersionService', () => {
  let service: VersionService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VersionService>(VersionService);

    jest.clearAllMocks();
  });

  describe('normalizeQuery', () => {
    it('should normalize empty object', () => {
      expect(service.normalizeQuery({})).toBe('{}');
    });

    it('should sort object keys', () => {
      const query = { z: 1, a: 2, m: 3 };
      const result = service.normalizeQuery(query);

      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should sort array values', () => {
      const query = { tags: ['z', 'a', 'm'] };
      const result = service.normalizeQuery(query);

      expect(result).toBe('{"tags":["a","m","z"]}');
    });

    it('should handle nested objects', () => {
      const query = {
        filter: { status: 'active', priority: 'high' },
        sort: ['name', 'date'],
      };
      const result = service.normalizeQuery(query);

      expect(result).toBe(
        '{"filter":{"priority":"high","status":"active"},"sort":["date","name"]}',
      );
    });

    it('should preserve null and undefined', () => {
      const query = { a: null, b: undefined, c: 'value' };
      const result = service.normalizeQuery(query);

      expect(result).toBe('{"a":null,"b":null,"c":"value"}');
    });

    it('should preserve number types', () => {
      const query = { page: 1, limit: 25, active: true };
      const result = service.normalizeQuery(query);

      expect(result).toBe('{"active":true,"limit":25,"page":1}');
    });

    it('should handle deeply nested structures', () => {
      const query = {
        filters: {
          user: { status: 'active', roles: ['admin', 'user'] },
          date: { from: '2024-01-01', to: '2024-12-31' },
        },
        pagination: { page: 1, limit: 10 },
      };
      const result = service.normalizeQuery(query);
      const expected = JSON.stringify({
        filters: {
          date: { from: '2024-01-01', to: '2024-12-31' },
          user: { roles: ['admin', 'user'], status: 'active' },
        },
        pagination: { limit: 10, page: 1 },
      });

      expect(result).toBe(expected);
    });
  });

  describe('sha1', () => {
    it('should generate consistent hash', () => {
      const input = 'test-string';
      const hash1 = service.sha1(input);
      const hash2 = service.sha1(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = service.sha1('input1');
      const hash2 = service.sha1('input2');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hex characters only', () => {
      const hash = service.sha1('test');

      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('getVersion', () => {
    it('should generate version for nodes resource', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ v: BigInt(1704110400), c: BigInt(50) }]);

      const version = await service.getVersion('nodes', { page: 1, limit: 10 });

      expect(version).toMatch(/^nodes:1704110400:50:[a-f0-9]{16}$/);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('FROM nodes'),
      );
    });

    it('should generate version for channels resource', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ v: BigInt(1704110500), c: BigInt(25) }]);

      const version = await service.getVersion('channels', { status: 'open' });

      expect(version).toMatch(/^channels:1704110500:25:[a-f0-9]{16}$/);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('FROM channels'),
      );
    });

    it('should include query hash in version', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ v: BigInt(1704110400), c: BigInt(50) }]);

      const version1 = await service.getVersion('nodes', { page: 1, limit: 10 });
      const version2 = await service.getVersion('nodes', { page: 2, limit: 10 });

      expect(version1).not.toBe(version2);
      expect(version1.split(':')[3]).not.toBe(version2.split(':')[3]);
    });

    it('should generate same version for same query parameters', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ v: BigInt(1704110400), c: BigInt(50) }]);

      const query = { page: 1, limit: 10, status: 'active' };
      const version1 = await service.getVersion('nodes', query);
      const version2 = await service.getVersion('nodes', { ...query });

      expect(version1).toBe(version2);
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB connection failed'));

      const version = await service.getVersion('nodes', {});

      expect(version).toMatch(/^nodes:\d+:0:[a-f0-9]{16}$/);
      const timestamp = parseInt(version.split(':')[1]);

      expect(timestamp).toBeGreaterThan(1704110000); // Reasonable timestamp
    });

    it('should handle empty query result', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const version = await service.getVersion('nodes', {});

      expect(version).toMatch(/^nodes:0:0:[a-f0-9]{16}$/);
    });

    it('should handle all supported resources', async () => {
      const resources = ['nodes', 'channels', 'assets', 'networks', 'app-sessions'];
      const tables = ['nodes', 'channels', 'assets', 'networks', 'app_sessions'];

      for (let i = 0; i < resources.length; i++) {
        mockPrismaService.$queryRaw.mockResolvedValue([
          { v: BigInt(1704110400 + i), c: BigInt(10 + i) },
        ]);

        const version = await service.getVersion(resources[i], {});

        expect(version).toMatch(new RegExp(`^${resources[i]}:\\d+:\\d+:[a-f0-9]{16}$`));
        expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining(`FROM ${tables[i]}`),
        );
      }
    });

    it('should handle unknown resource', async () => {
      await expect(service.getVersion('unknown', {})).rejects.toThrow('Unknown resource: unknown');
    });

    it('should properly escape table names in queries', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ v: BigInt(1704110400), c: BigInt(50) }]);

      await service.getVersion('app-sessions', {});

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('FROM app_sessions'),
      );
    });
  });
});

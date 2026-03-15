import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { NetworkService } from './network.service';
import { PrismaService } from '../../prisma/prisma.service';

const big = (n: number | string) => BigInt(n);

const makeNetwork = (overrides: Partial<any> = {}) => ({
  chain_id: big(1),
  name: 'Ethereum',
  custody_address: '0xCUSTODY',
  adjudicator_address: '0xADJ',
  broker_address: 'wss://broker',
  last_seen_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

describe('NetworkService', () => {
  let service: NetworkService;

  let findUniqueMock: jest.Mock;
  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findUniqueMock = jest.fn();
    findManyMock = jest.fn();
    countMock = jest.fn();
    transactionMock = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      if (typeof arg === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return arg();
      }

      return arg as unknown;
    });

    const prismaStub = {
      network: {
        findUnique: findUniqueMock,
        findMany: findManyMock,
        count: countMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = mod.get(NetworkService);
  });

  describe('getOne', () => {
    it('returns network and serializes BigInts', async () => {
      const row = makeNetwork({ chain_id: big(10), name: 'Sepolia' });

      findUniqueMock.mockResolvedValueOnce(row);

      const res = await service.getOne({ chainId: '10' });

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { chain_id: BigInt(10) } });
      expect(res).toMatchObject({ chain_id: '10', name: 'Sepolia' });
      expect(res.last_seen_at instanceof Date).toBe(true);
      expect(res.updated_at instanceof Date).toBe(true);
    });

    it('throws NotFound when missing', async () => {
      findUniqueMock.mockResolvedValueOnce(null);
      await expect(service.getOne({ chainId: '5' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('paginates (page/limit) and defaults to name asc; serializes BigInts', async () => {
      const rows = [
        makeNetwork({ chain_id: big(1), name: 'A-Net' }),
        makeNetwork({ chain_id: big(2), name: 'B-Net' }),
      ];

      findManyMock.mockResolvedValueOnce(rows);
      countMock.mockResolvedValueOnce(42);

      const res = await service.list({ page: 2, limit: 10 });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { name: 'asc' },
        }),
      );

      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.total).toBe(42);
      expect(res.totalPages).toBe(5);
      expect(res.hasMore).toBe(true);
      expect(res.items[0].chain_id).toBe('1');
    });

    it('applies filters (chainId/broker/q) and sort override', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({
        page: 1,
        limit: 25,
        chainId: '111',
        broker: 'wss://brokerX',
        q: 'eth',
        sortBy: 'last_seen_at',
        order: 'desc',
      });

      const args = findManyMock.mock.calls[0][0];

      expect(args.where).toEqual({
        chain_id: BigInt(111),
        broker_address: 'wss://brokerX',
        name: { contains: 'eth', mode: 'insensitive' },
      });
      expect(args.orderBy).toEqual({ last_seen_at: 'desc' });
    });

    it('empty page returns items=[], hasMore=false', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      const res = await service.list({ page: 1, limit: 25 });

      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.totalPages).toBe(0);
      expect(res.hasMore).toBe(false);
    });
  });

  describe('count', () => {
    it('counts with same where logic', async () => {
      countMock.mockResolvedValueOnce(7);

      const res = await service.count({
        chainId: '5',
        broker: 'wss://b',
        q: 'eth',
      });

      expect(countMock).toHaveBeenCalledWith({
        where: {
          chain_id: BigInt(5),
          broker_address: 'wss://b',
          name: { contains: 'eth', mode: 'insensitive' },
        },
      });
      expect(res).toEqual({ total: 7 });
    });
  });
});

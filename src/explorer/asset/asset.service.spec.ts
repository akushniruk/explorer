import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { AssetService } from './asset.service';
import { PrismaService } from '../../prisma/prisma.service';

const big = (n: string | number) => BigInt(n);

const makeAsset = (overrides: Partial<any> = {}) => ({
  token: '0xTOKEN',
  chain_id: big(1),
  symbol: 'USDC',
  decimals: big(6),
  ...overrides,
});

describe('AssetService', () => {
  let service: AssetService;

  let findFirstMock: jest.Mock;
  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findFirstMock = jest.fn();
    findManyMock = jest.fn();
    countMock = jest.fn();
    transactionMock = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);

      if (typeof arg === 'function') return arg() as unknown;

      return arg as unknown;
    });

    const prismaStub = {
      asset: {
        findFirst: findFirstMock,
        findMany: findManyMock,
        count: countMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [
        AssetService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = mod.get(AssetService);
  });

  describe('getOne', () => {
    it('returns asset and serializes BigInts', async () => {
      const row = makeAsset({ token: '0xAAA', chain_id: big(10), decimals: big(18) });

      findFirstMock.mockResolvedValueOnce(row);

      const res = await service.getOne({ token: '0xAAA', chainId: '10' });

      expect(findFirstMock).toHaveBeenCalledWith({
        where: { token: '0xAAA', chain_id: BigInt(10) },
      });
      expect(res).toEqual({
        ...row,
        chain_id: '10',
        decimals: '18',
      });
    });

    it('throws NotFound when not found', async () => {
      findFirstMock.mockResolvedValueOnce(null);
      await expect(service.getOne({ token: '0xMISSING', chainId: '1' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('paginates (page/limit) and defaults to symbol asc', async () => {
      const rows = [
        makeAsset({ token: '0x1', symbol: 'AAA', chain_id: big(1), decimals: big(6) }),
        makeAsset({ token: '0x2', symbol: 'BBB', chain_id: big(1), decimals: big(6) }),
      ];

      findManyMock.mockResolvedValueOnce(rows);
      countMock.mockResolvedValueOnce(42);

      const res = await service.list({ page: 2, limit: 10 });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { symbol: 'asc' },
        }),
      );

      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.total).toBe(42);
      expect(res.totalPages).toBe(Math.ceil(42 / 10));
      expect(res.hasMore).toBe(true);

      expect(res.items[0].chain_id).toBe('1');
      expect(res.items[0].decimals).toBe('6');
    });

    it('applies filters (token/chainId/q) and sort overrides', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({
        page: 1,
        limit: 25,
        token: '0xT',
        chainId: '111',
        q: 'usd',
        sortBy: 'chain_id',
        order: 'desc',
      });

      const args = findManyMock.mock.calls[0][0];

      expect(args.where).toEqual({
        token: '0xT',
        chain_id: BigInt(111),
        symbol: { contains: 'usd', mode: 'insensitive' },
      });
      expect(args.orderBy).toEqual({ chain_id: 'desc' });
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
      const res = await service.count({ token: '0xT', chainId: '5', q: 'eth' });

      expect(countMock).toHaveBeenCalledWith({
        where: {
          token: '0xT',
          chain_id: BigInt(5),
          symbol: { contains: 'eth', mode: 'insensitive' },
        },
      });
      expect(res).toEqual({ total: 7 });
    });
  });
});

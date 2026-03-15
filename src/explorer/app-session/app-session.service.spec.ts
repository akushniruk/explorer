import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { AppSessionService } from './app-session.service';
import { PrismaService } from '../../prisma/prisma.service';

const big = (n: number | string) => BigInt(n);

const makeSession = (overrides: Partial<any> = {}) => ({
  id: 1,
  protocol: 'NitroRPC/0.2',
  session_id: '0xSESS1',
  channel_id: '0xCHAN1',
  nonce: big(1),
  participants: ['0xP1', '0xP2'],
  weight: [1, 1],
  quorum: big(100),
  version: big(1),
  status: 'active',
  challenge: big(0),
  session_data: null,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-02T00:00:00Z'),
  ...overrides,
});

describe('AppSessionService', () => {
  let service: AppSessionService;

  let findUniqueMock: jest.Mock;
  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findUniqueMock = jest.fn();
    findManyMock = jest.fn();
    countMock = jest.fn();
    transactionMock = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);

      if (typeof arg === 'function') return arg() as unknown;

      return arg as unknown;
    });

    const prismaStub = {
      appSession: {
        findUnique: findUniqueMock,
        findMany: findManyMock,
        count: countMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [
        AppSessionService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = mod.get(AppSessionService);
  });

  describe('getOne', () => {
    it('returns a session and serializes BigInts', async () => {
      const row = makeSession({
        session_id: '0xAAA',
        nonce: big('18446744073709551615'),
        version: big(2),
        quorum: big(200),
        challenge: big(0),
      });

      findUniqueMock.mockResolvedValueOnce(row);

      const res = await service.getOne({ sessionId: '0xAAA' });

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { session_id: '0xAAA' },
      });
      expect(res).toMatchObject({
        session_id: '0xAAA',
        nonce: '18446744073709551615',
        version: '2',
        quorum: '200',
        challenge: '0',
      });
      expect(res.created_at instanceof Date).toBe(true);
      expect(res.updated_at instanceof Date).toBe(true);
    });

    it('throws NotFound when not found', async () => {
      findUniqueMock.mockResolvedValueOnce(null);
      await expect(service.getOne({ sessionId: '0xMISSING' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('paginates (page/limit), defaults sort updated_at desc, serializes BigInts', async () => {
      const rows = [
        makeSession({ session_id: '0x1', nonce: big(1) }),
        makeSession({ session_id: '0x2', nonce: big(2) }),
      ];

      findManyMock.mockResolvedValueOnce(rows);
      countMock.mockResolvedValueOnce(42);

      const res = await service.list({ page: 2, limit: 10 });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { updated_at: 'desc' },
        }),
      );

      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.total).toBe(42);
      expect(res.totalPages).toBe(5);
      expect(res.hasMore).toBe(true);
      expect(res.items[0]).toMatchObject({ session_id: '0x1', nonce: '1' });
    });

    it('applies filters (status/channelId/participant/q) and sort override', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({
        page: 1,
        limit: 25,
        status: 'active',
        channelId: '0xCHAN',
        participant: '0xP1',
        q: '0xabc',
        sortBy: 'created_at',
        order: 'asc',
      });

      const args = findManyMock.mock.calls[0][0];

      expect(args.where).toEqual({
        status: 'active',
        channel_id: '0xCHAN',
        participants: { has: '0xP1' },
        OR: [{ session_id: { startsWith: '0xabc' } }, { channel_id: { startsWith: '0xabc' } }],
      });
      expect(args.orderBy).toEqual({ created_at: 'asc' });
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
        status: 'active',
        channelId: '0xCHAN',
        participant: '0xP2',
        q: '0xabc',
      });

      expect(countMock).toHaveBeenCalledWith({
        where: {
          status: 'active',
          channel_id: '0xCHAN',
          participants: { has: '0xP2' },
          OR: [{ session_id: { startsWith: '0xabc' } }, { channel_id: { startsWith: '0xabc' } }],
        },
      });
      expect(res).toEqual({ total: 7 });
    });
  });
});

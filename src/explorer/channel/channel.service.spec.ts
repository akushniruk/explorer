import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { PrismaService } from '../../prisma/prisma.service';

const big = (n: number) => BigInt(n);

const makeChannel = (overrides: Partial<any> = {}) => ({
  channel_id: '0xCH-1',
  chain_id: big(1),
  token: '0xTOKEN',
  wallet: '0xWALLET',
  participant: '0xPARTICIPANT',
  amount: big(123456),
  status: 'open',
  challenge: big(0),
  nonce: big(1),
  version: big(1),
  adjudicator: '0xADJ',
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-02T00:00:00Z'),
  ...overrides,
});

describe('ChannelService', () => {
  let service: ChannelService;

  // keep mocks in locals to avoid "unbound-method" lint
  let findUniqueMock: jest.Mock;
  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findUniqueMock = jest.fn();
    findManyMock = jest.fn();
    countMock = jest.fn();

    // robust $transaction mock: handles array form and callback form
    transactionMock = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);

      // not used in our svc, but safe
      if (typeof arg === 'function') return arg() as Promise<unknown>;

      return arg as Promise<unknown>;
    });

    const prismaStub = {
      channel: {
        findUnique: findUniqueMock,
        findMany: findManyMock,
        count: countMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [ChannelService, { provide: PrismaService, useValue: prismaStub }],
    }).compile();

    service = mod.get(ChannelService);
  });

  describe('getOne', () => {
    it('returns a channel with BigInts serialized to strings', async () => {
      const row = makeChannel({ channel_id: '0xAAA', chain_id: big(10), amount: big(999) });

      findUniqueMock.mockResolvedValueOnce(row);

      const res = await service.getOne({ channelId: '0xAAA' });

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { channel_id: '0xAAA' } });
      expect(res).toMatchObject({
        channel_id: '0xAAA',
        chain_id: '10',
        amount: '999',
        nonce: '1',
        version: '1',
      });
      expect(res.created_at instanceof Date).toBe(true);
      expect(res.updated_at instanceof Date).toBe(true);
    });

    it('throws NotFoundException when channel not found', async () => {
      findUniqueMock.mockResolvedValueOnce(null);
      await expect(service.getOne({ channelId: '0xMISSING' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('paginates with page/limit, defaults sort to updated_at desc, serializes BigInts', async () => {
      const items = [
        makeChannel({ channel_id: '0x1', chain_id: big(1), amount: big(1) }),
        makeChannel({ channel_id: '0x2', chain_id: big(1), amount: big(2) }),
      ];

      findManyMock.mockResolvedValueOnce(items);
      countMock.mockResolvedValueOnce(42);

      const res = await service.list({
        page: 2, // -> offset = 10 when limit=10
        limit: 10,
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { updated_at: 'desc' },
        }),
      );

      expect(res.total).toBe(42);
      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.totalPages).toBe(Math.ceil(42 / 10));
      expect(res.hasMore).toBe(true);

      expect(res.items[0]).toMatchObject({ chain_id: '1', amount: '1', nonce: '1', version: '1' });
    });

    it('applies filters including chainId BigInt', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({
        page: 1,
        limit: 25,
        status: 'open',
        token: '0xTOKEN',
        chainId: '111',
        wallet: '0xwal',
        participant: '0xpar',
        q: '0xabc',
        sortBy: 'created_at',
        order: 'asc',
      });

      const args = findManyMock.mock.calls[0][0];

      expect(args.orderBy).toEqual({ created_at: 'asc' });
      expect(args.take).toBe(25);
      expect(args.skip).toBe(0);
      expect(args.where.status).toBe('open');
      expect(args.where.token).toBe('0xTOKEN');
      expect(args.where.chain_id).toBe(BigInt(111));
      expect(args.where.wallet).toEqual({ startsWith: '0xwal', mode: 'insensitive' });
      expect(args.where.participant).toEqual({ startsWith: '0xpar', mode: 'insensitive' });
      expect(Array.isArray(args.where.OR)).toBe(true);
      expect(args.where.OR.length).toBeGreaterThan(0);
    });

    it('returns empty page correctly (items=[], hasMore=false, totalPages computed)', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      const res = await service.list({ page: 1, limit: 25 });

      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.totalPages).toBe(0);
      expect(res.hasMore).toBe(false);
    });

    it('last page when total % limit === 0 has hasMore=false', async () => {
      // total=20, limit=10 => pages: 1..2; last page is page=2
      findManyMock.mockResolvedValueOnce([makeChannel({ channel_id: '0xLAST' })]);
      countMock.mockResolvedValueOnce(20);

      const res = await service.list({ page: 2, limit: 10 });

      expect(res.page).toBe(2);
      expect(res.totalPages).toBe(2);
      expect(res.hasMore).toBe(false);
    });

    it('sorts by amount asc when requested', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({ page: 1, limit: 10, sortBy: 'amount', order: 'asc' });

      const args = findManyMock.mock.calls[0][0];

      expect(args.orderBy).toEqual({ amount: 'asc' });
    });

    it('wallet/participant filters are case-insensitive prefix matches', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({
        page: 1,
        limit: 10,
        wallet: '0xDeadBEEF',
        participant: '0xCafeBABE',
      });

      const args = findManyMock.mock.calls[0][0];

      expect(args.where.wallet).toEqual({ startsWith: '0xDeadBEEF', mode: 'insensitive' });
      expect(args.where.participant).toEqual({ startsWith: '0xCafeBABE', mode: 'insensitive' });
    });

    it('quick search (q) alone emits OR on channel_id/wallet/participant', async () => {
      findManyMock.mockResolvedValueOnce([]);
      countMock.mockResolvedValueOnce(0);

      await service.list({ page: 1, limit: 10, q: '0xabc' });

      const args = findManyMock.mock.calls[0][0];

      expect(args.where.OR).toEqual(
        expect.arrayContaining([
          { channel_id: { startsWith: '0xabc' } },
          { wallet: { startsWith: '0xabc', mode: 'insensitive' } },
          { participant: { startsWith: '0xabc', mode: 'insensitive' } },
        ]),
      );
    });

    it('serializes very large BigInts to strings', async () => {
      const huge = (n: string) => BigInt(n);
      const row = makeChannel({
        chain_id: huge('999999999999999999'),
        amount: huge('340282366920938463463374607431768211455'), // ~2^128-1 example
        nonce: huge('18446744073709551615'), // 2^64-1
      });

      findManyMock.mockResolvedValueOnce([row]);
      countMock.mockResolvedValueOnce(1);

      const res = await service.list({ page: 1, limit: 1 });

      expect(res.items[0].chain_id).toBe('999999999999999999');
      expect(res.items[0].amount).toBe('340282366920938463463374607431768211455');
      expect(res.items[0].nonce).toBe('18446744073709551615');
    });
  });

  describe('count', () => {
    it('returns total and converts chainId to BigInt', async () => {
      countMock.mockResolvedValueOnce(7);
      const res = await service.count({ status: 'open', token: '0xT', chainId: '5' });

      expect(countMock).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'open',
          token: '0xT',
          chain_id: BigInt(5),
        }),
      });
      expect(res).toEqual({ total: 7 });
    });
  });

  it('count uses same where filters (status/token/chainId)', async () => {
    countMock.mockResolvedValueOnce(3);

    const filters = { status: 'active', token: '0xT0', chainId: '10' } as const;
    const res = await service.count(filters);

    expect(res).toEqual({ total: 3 });
    expect(countMock).toHaveBeenCalledWith({
      where: { status: 'active', token: '0xT0', chain_id: BigInt(10) },
    });
  });
});

import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeService } from './node.service';
import { Prisma } from '@prisma/client';

const D = (n: number | string) => new Prisma.Decimal(n);

const makeNode = (overrides: Partial<any> = {}) => ({
  id: 'cuid_1',
  slug: 'kayen-frankfurt',
  name: 'Kayen Frankfurt',
  ws_url: 'wss://kayen-frankfurt.nodes.invalid/ws',
  website_host: 'kayen.example',
  icon_key: 'kayen',
  description: 'Regulated clearing node in Frankfurt; low latency across Central EU.',
  country_code: 'DE',
  region: 'europe',
  latitude: D(50.1109),
  longitude: D(8.6821),
  status: 'unknown',
  available: false,
  latency_ms: null,
  last_seen_at: null,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

describe('NodeService', () => {
  let service: NodeService;

  let findManyMock: jest.Mock;
  let countMock: jest.Mock;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    findManyMock = jest.fn();
    countMock = jest.fn();
    transactionMock = jest.fn(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);

      if (typeof arg === 'function') return arg() as unknown;

      return arg as unknown;
    });

    const prismaStub = {
      node: {
        findMany: findManyMock,
        count: countMock,
      },
      $transaction: transactionMock,
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [NodeService, { provide: PrismaService, useValue: prismaStub }],
    }).compile();

    service = mod.get(NodeService);
  });

  it('paginates with page/limit, default sort name asc, serializes decimals to numbers', async () => {
    const rows = [
      makeNode({ slug: 'a', name: 'A-Net', latitude: D(10.1), longitude: D(20.2) }),
      makeNode({ slug: 'b', name: 'B-Net', latitude: D(30.3), longitude: D(40.4) }),
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

    // serialized item
    expect(res.items[0]).toMatchObject({
      slug: 'a',
      name: 'A-Net',
      latitude: 10.1,
      longitude: 20.2,
    });
  });

  it('applies filters: q (name contains), country uppercased, region, status', async () => {
    findManyMock.mockResolvedValueOnce([]);
    countMock.mockResolvedValueOnce(0);

    await service.list({
      page: 1,
      limit: 25,
      q: 'bit',
      country: 'us',
      region: 'north_america',
      status: 'offline',
      sortBy: 'updated_at',
      order: 'desc',
    });

    const args = findManyMock.mock.calls[0][0];

    expect(args.where).toEqual({
      name: { contains: 'bit', mode: 'insensitive' },
      country_code: 'US',
      region: 'north_america',
      status: 'offline',
    });
    expect(args.orderBy).toEqual({ updated_at: 'desc' });
  });

  it('applies bbox filter as AND on latitude/longitude (Decimal ranges)', async () => {
    findManyMock.mockResolvedValueOnce([]);
    countMock.mockResolvedValueOnce(0);

    await service.list({
      page: 1,
      limit: 25,
      bbox: '35,-10,60,30',
    });

    const args = findManyMock.mock.calls[0][0];

    expect(Array.isArray(args.where.AND)).toBe(true);
    const [latCond, lngCond] = args.where.AND!;

    expect(latCond.latitude.gte.toString()).toBe('35');
    expect(latCond.latitude.lte.toString()).toBe('60');
    expect(lngCond.longitude.gte.toString()).toBe('-10');
    expect(lngCond.longitude.lte.toString()).toBe('30');
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

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

describe('AssetController (HTTP)', () => {
  let app: INestApplication;

  let getOneMock: jest.Mock;
  let listMock: jest.Mock;
  let countMock: jest.Mock;

  beforeAll(async () => {
    getOneMock = jest.fn();
    listMock = jest.fn();
    countMock = jest.fn();

    const mod = await Test.createTestingModule({
      imports: [
        // enable rate-limit headers; route decorators set per-endpoint limits
        ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }]),
      ],
      controllers: [AssetController],
      providers: [
        {
          provide: AssetService,
          useValue: {
            getOne: getOneMock,
            list: listMock,
            count: countMock,
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/asset requires token & chainId (validation)', async () => {
    await request(app.getHttpServer()).get('/api/v1/asset').expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/asset')
      .query({ token: '0xT' }) // missing chainId
      .expect(400);

    // valid
    getOneMock.mockResolvedValueOnce({
      token: '0xT',
      chain_id: '1',
      symbol: 'ETH',
      decimals: '18',
    });
    await request(app.getHttpServer())
      .get('/api/v1/asset')
      .query({ token: '0xT', chainId: '1' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=30');
    expect(getOneMock).toHaveBeenCalledWith({ token: '0xT', chainId: '1' });
  });

  it('GET /api/v1/asset/list passes DTO values and returns 200 with cache header', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/asset/list')
      .query({ page: '2', limit: '10', q: 'usdc', sortBy: 'symbol', order: 'asc' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, q: 'usdc', sortBy: 'symbol', order: 'asc' }),
    );
    expect(res.body).toEqual({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });
  });

  it('GET /api/v1/asset/count forwards filters and returns 200 with cache header', async () => {
    countMock.mockResolvedValueOnce({ total: 12 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/asset/count')
      .query({ q: 'eth', chainId: '1' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=30');

    expect(countMock).toHaveBeenCalledWith({ q: 'eth', chainId: '1' });
    expect(res.body).toEqual({ total: 12 });
  });

  it('throttling headers present on asset routes', async () => {
    const s = app.getHttpServer();

    getOneMock.mockResolvedValueOnce({
      token: '0xT',
      chain_id: '1',
      symbol: 'ETH',
      decimals: '18',
    });
    const res = await request(s)
      .get('/api/v1/asset')
      .query({ token: '0xT', chainId: '1' })
      .expect(200);

    const limit = Number(res.headers['x-ratelimit-limit']);
    const rem = Number(res.headers['x-ratelimit-remaining']);

    expect(Number.isFinite(limit)).toBe(true);
    expect(Number.isFinite(rem)).toBe(true);
  });
});

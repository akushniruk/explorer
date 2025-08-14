import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

describe('NetworkController (HTTP)', () => {
  let app: INestApplication;

  let getOneMock: jest.Mock;
  let listMock: jest.Mock;
  let countMock: jest.Mock;

  beforeAll(async () => {
    getOneMock = jest.fn();
    listMock = jest.fn();
    countMock = jest.fn();

    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }])],
      controllers: [NetworkController],
      providers: [
        {
          provide: NetworkService,
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

  it('GET /api/v1/network requires chainId (validation) and returns 200 when provided', async () => {
    await request(app.getHttpServer()).get('/api/v1/network').expect(400);

    getOneMock.mockResolvedValueOnce({ chain_id: '1', name: 'Ethereum' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/network')
      .query({ chainId: '1' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(getOneMock).toHaveBeenCalledWith({ chainId: '1' });
    expect(res.body).toEqual({ chain_id: '1', name: 'Ethereum' });
  });

  it('GET /api/v1/network/:id routes correctly and sets cache header', async () => {
    getOneMock.mockResolvedValueOnce({ chain_id: '10', name: 'Sepolia' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/network/10')
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(getOneMock).toHaveBeenCalledWith({ chainId: '10' });
    expect(res.body).toEqual({ chain_id: '10', name: 'Sepolia' });
  });

  it('GET /api/v1/network/list transforms DTO (page/limit numbers) and returns 200', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/network/list')
      .query({
        page: '2',
        limit: '10',
        q: 'eth',
        broker: 'wss://b',
        sortBy: 'last_seen_at',
        order: 'desc',
      })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        q: 'eth',
        broker: 'wss://b',
        sortBy: 'last_seen_at',
        order: 'desc',
      }),
    );

    expect(res.body).toEqual({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    // sanity: ensure list path didn't get captured by :id
    expect(getOneMock).not.toHaveBeenCalledWith({ chainId: 'list' });
  });

  it('GET /api/v1/network/count forwards filters and sets cache header', async () => {
    countMock.mockResolvedValueOnce({ total: 5 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/network/count')
      .query({ q: 'eth', chainId: '1', broker: 'wss://b' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=30');

    expect(countMock).toHaveBeenCalledWith({ q: 'eth', chainId: '1', broker: 'wss://b' });
    expect(res.body).toEqual({ total: 5 });
  });

  it('throttling headers present on routes', async () => {
    getOneMock.mockResolvedValueOnce({ chain_id: '1', name: 'Ethereum' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/network')
      .query({ chainId: '1' })
      .expect(200);

    const limit = Number(res.headers['x-ratelimit-limit']);
    const remaining = Number(res.headers['x-ratelimit-remaining']);

    expect(Number.isFinite(limit)).toBe(true);
    expect(Number.isFinite(remaining)).toBe(true);
  });
});

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { NodeController } from './node.controller';
import { NodeService } from './node.service';

const describeHttp = process.env.RUN_HTTP_TESTS === '1' ? describe : describe.skip;

describeHttp('NodeController (HTTP)', () => {
  let app: INestApplication<App>;

  let listMock: jest.Mock;

  beforeAll(async () => {
    listMock = jest.fn();

    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }])],
      controllers: [NodeController],
      providers: [
        { provide: NodeService, useValue: { list: listMock } },
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

  it('GET /api/v1/nodes/list transforms DTO (page/limit numbers) and returns 200', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/nodes/list')
      .query({
        page: '2',
        limit: '10',
        q: 'kay',
        country: 'de',
        region: 'europe',
        status: 'offline',
        bbox: '35,-10,60,30',
        sortBy: 'updated_at',
        order: 'desc',
      })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=30');

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        q: 'kay',
        country: 'de',
        region: 'europe',
        status: 'offline',
        bbox: '35,-10,60,30',
        sortBy: 'updated_at',
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
  });

  it('rejects invalid bbox (validation)', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/nodes/list')
      .query({
        page: '1',
        limit: '25',
        bbox: 'bad,bbox,string,here',
      })
      .expect(400);
  });

  it('throttling headers present', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/nodes/list?page=1&limit=25')
      .expect(200);

    const limit = Number(res.headers['x-ratelimit-limit']);
    const remaining = Number(res.headers['x-ratelimit-remaining']);

    expect(Number.isFinite(limit)).toBe(true);
    expect(Number.isFinite(remaining)).toBe(true);
  });
});

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';

describe('ChannelController throttling (HTTP)', () => {
  let app: INestApplication<App>;

  // local mocks (avoid unbound-method lint)
  let getOneMock: jest.Mock;
  let listMock: jest.Mock;
  let countMock: jest.Mock;

  beforeAll(async () => {
    getOneMock = jest.fn().mockResolvedValue({ channel_id: '0xAAA' });
    listMock = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 1,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });
    countMock = jest.fn().mockResolvedValue({ total: 0 });

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Global throttler (headers enabled by default)
        ThrottlerModule.forRoot([
          { ttl: 60, limit: 60 }, // doesn’t matter; route decorator overrides anyway
        ]),
      ],
      controllers: [ChannelController],
      providers: [
        {
          provide: ChannelService,
          useValue: { getOne: getOneMock, list: listMock, count: countMock },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies throttling: X-RateLimit headers present and remaining decrements between calls', async () => {
    const server = app.getHttpServer();

    const first = await request(server)
      .get('/api/v1/channel')
      .query({ channelId: '0xAAA' })
      .expect(200);

    const lim1 = Number(first.headers['x-ratelimit-limit']);
    const rem1 = Number(first.headers['x-ratelimit-remaining']);

    expect(Number.isFinite(lim1)).toBe(true);
    expect(Number.isFinite(rem1)).toBe(true);

    const second = await request(server)
      .get('/api/v1/channel')
      .query({ channelId: '0xAAA' })
      .expect(200);

    const rem2 = Number(second.headers['x-ratelimit-remaining']);

    // should decrement by 1 within the same TTL window
    expect(rem2).toBe(rem1 - 1);
  });

  it('returns 200 with proper Cache-Control on throttled routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/channel')
      .query({ channelId: '0xAAA' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=5');
  });
});

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppSessionController } from './app-session.controller';
import { AppSessionService } from './app-session.service';

describe('AppSessionController (HTTP)', () => {
  let app: INestApplication<App>;

  let getOneMock: jest.Mock;
  let listMock: jest.Mock;
  let countMock: jest.Mock;

  beforeAll(async () => {
    getOneMock = jest.fn();
    listMock = jest.fn();
    countMock = jest.fn();

    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }])],
      controllers: [AppSessionController],
      providers: [
        {
          provide: AppSessionService,
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

  it('GET /api/v1/app-session requires sessionId (validation) and returns 200 when provided', async () => {
    await request(app.getHttpServer()).get('/api/v1/app-session').expect(400);

    getOneMock.mockResolvedValueOnce({
      session_id: '0xAAA',
      nonce: '1',
      version: '1',
      quorum: '100',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app-session')
      .query({ sessionId: '0xAAA' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(getOneMock).toHaveBeenCalledWith({ sessionId: '0xAAA' });
    expect(res.body).toEqual({ session_id: '0xAAA', nonce: '1', version: '1', quorum: '100' });
  });

  it('GET /api/v1/app-session/:id routes correctly and sets cache header', async () => {
    getOneMock.mockResolvedValueOnce({ session_id: '0xSESS', nonce: '2' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app-session/0xSESS')
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(getOneMock).toHaveBeenCalledWith({ sessionId: '0xSESS' });
    expect(res.body).toEqual({ session_id: '0xSESS', nonce: '2' });
  });

  it('GET /api/v1/app-session/list transforms DTO (page/limit numbers) and returns 200', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app-session/list')
      .query({
        page: '2',
        limit: '10',
        status: 'active',
        channelId: '0xCHAN',
        participant: '0xP1',
        q: '0xabc',
        sortBy: 'updated_at',
        order: 'desc',
      })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'active',
        channelId: '0xCHAN',
        participant: '0xP1',
        q: '0xabc',
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

    // ensure list path didn't get captured by :id
    expect(getOneMock).not.toHaveBeenCalledWith({ sessionId: 'list' });
  });

  it('GET /api/v1/app-session/count forwards filters and sets cache header', async () => {
    countMock.mockResolvedValueOnce({ total: 9 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app-session/count')
      .query({ status: 'active', channelId: '0xCHAN', participant: '0xP1', q: '0xabc' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=30');

    expect(countMock).toHaveBeenCalledWith({
      status: 'active',
      channelId: '0xCHAN',
      participant: '0xP1',
      q: '0xabc',
    });
    expect(res.body).toEqual({ total: 9 });
  });

  it('throttling headers present on routes', async () => {
    getOneMock.mockResolvedValueOnce({ session_id: '0xAAA', nonce: '1' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app-session')
      .query({ sessionId: '0xAAA' })
      .expect(200);

    const limit = Number(res.headers['x-ratelimit-limit']);
    const remaining = Number(res.headers['x-ratelimit-remaining']);

    expect(Number.isFinite(limit)).toBe(true);
    expect(Number.isFinite(remaining)).toBe(true);
  });
});

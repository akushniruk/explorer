import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';

import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';

const describeHttp = process.env.RUN_HTTP_TESTS === '1' ? describe : describe.skip;

describeHttp('ChannelController (HTTP)', () => {
  let app: INestApplication<App>;

  // keep mocks in locals to avoid the "unbound-method" lint issue
  let getOneMock: jest.Mock;
  let listMock: jest.Mock;
  let countMock: jest.Mock;

  beforeAll(async () => {
    getOneMock = jest.fn();
    listMock = jest.fn();
    countMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [ChannelController],
      providers: [
        {
          provide: ChannelService,
          useValue: {
            getOne: getOneMock,
            list: listMock,
            count: countMock,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // replicate main.ts behavior
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true, // important: parses page/limit into numbers
        forbidNonWhitelisted: false,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/channel?channelId=... -> calls getOne() and returns 200 with cache header', async () => {
    getOneMock.mockResolvedValueOnce({ channel_id: '0xABC' });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel')
      .query({ channelId: '0xABC' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=5');

    expect(getOneMock).toHaveBeenCalledWith({ channelId: '0xABC' });
    expect(res.body).toEqual({ channel_id: '0xABC' });
  });

  it('GET /api/v1/channel/:id -> calls getOne() with param and returns 200', async () => {
    getOneMock.mockResolvedValueOnce({ channel_id: '0xDEF' });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/0xDEF')
      .expect(200)
      .expect('Cache-Control', 'public, max-age=5');

    expect(getOneMock).toHaveBeenCalledWith({ channelId: '0xDEF' });
    expect(res.body).toEqual({ channel_id: '0xDEF' });
  });

  it('GET /api/v1/channel/list -> calls list() with transformed DTO (page/limit numbers)', async () => {
    listMock.mockResolvedValueOnce({
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({
        page: '2',
        limit: '10',
        status: 'open',
        chainId: '1', // stays string per DTO (IsNumberString)
        token: '0xT',
        q: '0xabc',
        order: 'desc',
        sortBy: 'updated_at',
      })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=5');

    // list() gets transformed numeric page/limit
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'open',
        chainId: '1',
        token: '0xT',
        q: '0xabc',
        order: 'desc',
        sortBy: 'updated_at',
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

    // ensure getOne was NOT mistakenly called (route ordering sanity)
    expect(getOneMock).not.toHaveBeenCalledWith(expect.objectContaining({ channelId: 'list' }));
  });

  it('GET /api/v1/channel/count -> calls count() with filters and returns 200 with longer cache header', async () => {
    countMock.mockResolvedValueOnce({ total: 123 });

    const res = await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/count')
      .query({ status: 'open', chainId: '1', token: '0xT0' })
      .expect(200)
      .expect('Cache-Control', 'public, max-age=15');

    expect(countMock).toHaveBeenCalledWith({
      status: 'open',
      chainId: '1',
      token: '0xT0',
    });
    expect(res.body).toEqual({ total: 123 });
  });

  it('GET /api/v1/channel without channelId -> 400 (validation)', async () => {
    await request(app.getHttpAdapter().getInstance()).get('/api/v1/channel').expect(400);
  });

  it('GET /api/v1/channel/list rejects invalid page/limit/sort/order/chainId', async () => {
    // page must be >=1
    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({ page: '0', limit: '10' })
      .expect(400);

    // limit must be >=1
    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({ page: '1', limit: '0' })
      .expect(400);

    // invalid sortBy
    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({ page: '1', limit: '10', sortBy: 'foo' })
      .expect(400);

    // invalid order
    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({ page: '1', limit: '10', order: 'nope' })
      .expect(400);

    // chainId must be numeric string
    await request(app.getHttpAdapter().getInstance())
      .get('/api/v1/channel/list')
      .query({ page: '1', limit: '10', chainId: 'abc' })
      .expect(400);
  });
});

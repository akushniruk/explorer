import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ETag Caching (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'ENABLE_ETAG') return 'true';

          if (key === 'PORT') return 3000;

          if (key === 'NODE_ENV') return 'test';

          return process.env[key];
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Apply global configuration like in main.ts
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: 1, // VersioningType.URI
      defaultVersion: '1',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/nodes/list', () => {
    it('should return 200 with ETag on first request', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nodes/list').expect(200);

      expect(response.headers.etag).toMatch(/^W\/"nodes:\d+:\d+:[a-f0-9]{16}"$/);
      expect(response.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.requestId).toBeDefined();
    });

    it('should return 304 when If-None-Match matches ETag', async () => {
      // First request to get ETag
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/nodes/list')
        .expect(200);

      const etag = firstResponse.headers.etag;

      expect(etag).toBeDefined();

      // Second request with If-None-Match
      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/nodes/list')
        .set('If-None-Match', etag)
        .expect(304);

      expect(secondResponse.body).toEqual({});
      expect(secondResponse.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
      expect(secondResponse.headers.etag).toBeUndefined(); // 304 responses don't typically include ETag
    });

    it('should return 200 with different ETag after data change', async () => {
      // First request
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/nodes/list')
        .expect(200);

      const firstEtag = firstResponse.headers.etag;

      // Simulate data change by creating a new node
      const createdNode = await prismaService.node.create({
        data: {
          slug: 'test-node-etag-e2e',
          name: 'Test Node for ETag E2E',
          ws_url: 'wss://test-etag-e2e.example.com',
          country_code: 'US',
          region: 'north_america',
          latitude: 40.7128,
          longitude: -74.006,
          status: 'online',
          available: true,
        },
      });

      try {
        // Second request after data change
        const secondResponse = await request(app.getHttpServer())
          .get('/api/v1/nodes/list')
          .expect(200);

        const secondEtag = secondResponse.headers.etag;

        expect(secondEtag).not.toBe(firstEtag);

        // Verify the count has increased
        const firstCount = parseInt(firstEtag.split(':')[2].replace('"', ''));
        const secondCount = parseInt(secondEtag.split(':')[2].replace('"', ''));

        expect(secondCount).toBeGreaterThan(firstCount);
      } finally {
        // Cleanup
        await prismaService.node.delete({
          where: { id: createdNode.id },
        });
      }
    });

    it('should generate different ETags for different query parameters', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/v1/nodes/list?page=1&limit=10')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/nodes/list?page=2&limit=10')
        .expect(200);

      expect(response1.headers.etag).not.toBe(response2.headers.etag);

      // Same resource and DB state, but different query hash
      const etag1Parts = response1.headers.etag.split(':');
      const etag2Parts = response2.headers.etag.split(':');

      expect(etag1Parts[0]).toBe(etag2Parts[0]); // Same resource
      expect(etag1Parts[1]).toBe(etag2Parts[1]); // Same version timestamp
      expect(etag1Parts[2]).toBe(etag2Parts[2]); // Same count
      expect(etag1Parts[3]).not.toBe(etag2Parts[3]); // Different query hash
    });

    it('should handle malformed If-None-Match header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/nodes/list')
        .set('If-None-Match', 'malformed-etag')
        .expect(200);

      expect(response.headers.etag).toMatch(/^W\/"nodes:\d+:\d+:[a-f0-9]{16}"$/);
    });
  });

  describe('/api/v1/channel/list', () => {
    it('should work with channel endpoints', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/channel/list').expect(200);

      expect(response.headers.etag).toMatch(/^W\/"channels:\d+:\d+:[a-f0-9]{16}"$/);
      expect(response.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
      expect(response.body.success).toBe(true);
    });

    it('should return 304 for matching channel ETag', async () => {
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/channel/list')
        .expect(200);

      const etag = firstResponse.headers.etag;

      await request(app.getHttpServer())
        .get('/api/v1/channel/list')
        .set('If-None-Match', etag)
        .expect(304);
    });

    it('should work with query parameters in channel endpoints', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/v1/channel/list?status=open')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/channel/list?status=closed')
        .expect(200);

      expect(response1.headers.etag).not.toBe(response2.headers.etag);
    });
  });

  describe('/api/v1/channel/count', () => {
    it('should work with count endpoints', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/channel/count').expect(200);

      expect(response.headers.etag).toMatch(/^W\/"channels:\d+:\d+:[a-f0-9]{16}"$/);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.count).toBe('number');
    });
  });

  describe('ETag disabled', () => {
    let appDisabled: INestApplication<App>;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: (key: string) => {
            if (key === 'ENABLE_ETAG') return 'false';

            if (key === 'PORT') return 3000;

            if (key === 'NODE_ENV') return 'test';

            return process.env[key];
          },
        })
        .compile();

      appDisabled = moduleFixture.createNestApplication();

      appDisabled.setGlobalPrefix('api');
      appDisabled.enableVersioning({
        type: 1, // VersioningType.URI
        defaultVersion: '1',
      });

      await appDisabled.init();
    });

    afterAll(async () => {
      await appDisabled.close();
    });

    it('should not set ETag headers when disabled', async () => {
      const response = await request(appDisabled.getHttpServer())
        .get('/api/v1/nodes/list')
        .expect(200);

      expect(response.headers.etag).toBeUndefined();
      expect(response.body.success).toBe(true);
    });

    it('should ignore If-None-Match when disabled', async () => {
      const response = await request(appDisabled.getHttpServer())
        .get('/api/v1/nodes/list')
        .set('If-None-Match', 'W/"some-etag"')
        .expect(200);

      expect(response.headers.etag).toBeUndefined();
      expect(response.body.success).toBe(true);
    });
  });

  describe('Non-GET requests', () => {
    it('should not apply ETag to POST requests', async () => {
      // Note: This assumes there are no POST endpoints in the current implementation
      // If POST endpoints exist, this test should be updated accordingly
      const response = await request(app.getHttpServer())
        .post('/api/v1/channel')
        .send({})
        .expect(404); // Method not found, which is expected

      expect(response.headers.etag).toBeUndefined();
    });
  });

  describe('Endpoints without @EtagResource', () => {
    it('should not apply ETag to root endpoint', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      expect(response.headers.etag).toBeUndefined();
      expect(response.body).toBe('Hello World!');
    });
  });
});

// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';

import { PrismaModule } from './prisma/prisma.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { EtagInterceptor, VersionService } from './common/etag';
import { CacheService } from './common/cache';
import { ExplorerModule } from './explorer/explorer.module';
import { envValidationSchema } from './config/env.validation';
import { ApiModule } from './api/api.module';
import { HealthModule } from './health/health.module';
import { cacheConfig } from './config/cache.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE ?? '.env',
      validationSchema: envValidationSchema,
    }),
    CacheModule.register(cacheConfig),
    ThrottlerModule.forRoot([
      { ttl: 60, limit: 120 }, // sane default limit per IP
    ]),
    PrismaModule,
    ExplorerModule,
    ApiModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    VersionService,
    CacheService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EtagInterceptor },
  ],
  exports: [CacheService],
})
export class AppModule {}

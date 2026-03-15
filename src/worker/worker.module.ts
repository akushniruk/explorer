import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';
import { NodeConfigService } from './node-config/node-config.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import workerConfig from './worker.config';
import { envValidationSchema } from '../config/env.validation';
import { HealthService } from './health/health.service';
import { AppSessionService } from './app-session/app-session.service';
import { CacheService } from '../common/cache';
import { cacheConfig } from '../config/cache.config';
import { OnchainIndexerService } from './onchain/onchain-indexer.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    CacheModule.register(cacheConfig),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE ?? '.env',
      load: [workerConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
        convert: true,
      },
    }),
  ],
  providers: [
    WorkerService,
    YellowApiService,
    ChannelService,
    AssetService,
    HealthService,
    NodeConfigService,
    AppSessionService,
    CacheService,
    OnchainIndexerService,
  ],
})
export class WorkerModule {}

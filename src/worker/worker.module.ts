import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';
import { NodeConfigService } from './node-config/node-config.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import workerConfig from './worker.config';
import { envValidationSchema } from '../config/env.validation';
import { HealthService } from './health/health.service';
import { AppSessionService } from './app-session/app-session.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
})
export class WorkerModule {}

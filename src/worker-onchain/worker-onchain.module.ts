import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { envValidationSchema } from '../config/env.validation';
import workerOnchainConfig from './worker-onchain.config';
import { OnchainIndexerService } from './onchain-indexer.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE ?? '.env',
      load: [workerOnchainConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
        convert: true,
      },
    }),
  ],
  providers: [OnchainIndexerService],
})
export class WorkerOnchainModule {}

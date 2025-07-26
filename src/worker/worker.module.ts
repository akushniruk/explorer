import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { PrismaModule } from '../prisma/prisma.module'; // Assuming you have a PrismaModule
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [WorkerService, YellowApiService],
})
export class WorkerModule {}

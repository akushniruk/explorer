import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { PrismaModule } from '../prisma/prisma.module'; // Assuming you have a PrismaModule
import { ScheduleModule } from '@nestjs/schedule';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [WorkerService, YellowApiService, ChannelService, AssetService],
})
export class WorkerModule {}

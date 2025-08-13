import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelController } from './channel/channel.controller';
import { ChannelService } from './channel/channel.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelController],
  providers: [ChannelService],
})
export class ExplorerModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelController } from './channel/channel.controller';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';
import { AssetController } from './asset/asset.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelController, AssetController],
  providers: [ChannelService, AssetService],
})
export class ExplorerModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelController } from './channel/channel.controller';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';
import { AssetController } from './asset/asset.controller';
import { NetworkController } from './network/network.controller';
import { NetworkService } from './network/network.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelController, AssetController, NetworkController],
  providers: [ChannelService, AssetService, NetworkService],
})
export class ExplorerModule {}

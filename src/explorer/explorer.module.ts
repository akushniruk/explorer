import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChannelController } from './channel/channel.controller';
import { ChannelService } from './channel/channel.service';
import { AssetService } from './asset/asset.service';
import { AssetController } from './asset/asset.controller';
import { NetworkController } from './network/network.controller';
import { NetworkService } from './network/network.service';
import { AppSessionService } from './app-session/app-session.service';
import { AppSessionController } from './app-session/app-session.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelController, AssetController, NetworkController, AppSessionController],
  providers: [ChannelService, AssetService, NetworkService, AppSessionService],
})
export class ExplorerModule {}

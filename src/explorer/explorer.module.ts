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
import { NodeService } from './node/node.service';
import { NodeController } from './node/node.controller';
import { NodeConfigService } from './node-config/node-config.service';
import { NodeConfigController } from './node-config/node-config.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    ChannelController,
    AssetController,
    NetworkController,
    AppSessionController,
    NodeController,
    NodeConfigController,
  ],
  providers: [
    ChannelService,
    AssetService,
    NetworkService,
    AppSessionService,
    NodeService,
    NodeConfigService,
  ],
})
export class ExplorerModule {}

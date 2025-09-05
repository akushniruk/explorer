import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async processChannels(channelsResponse: GetChannelsResponseParams): Promise<void> {
    if (!channelsResponse || !channelsResponse.channels || channelsResponse.channels.length === 0)
      return;

    const startTime = Date.now();

    this.logger.log('Processing channel batch', {
      component: 'ChannelService',
      operation: 'process_channels',
      batchSize: channelsResponse.channels.length,
      startTime: new Date().toISOString(),
    });

    for (const channel of channelsResponse.channels) {
      const dataToUpsert = {
        channel_id: channel.channelId,
        participant: channel.participant,
        status: channel.status,
        token: channel.token,
        wallet: channel.wallet,
        amount:
          typeof channel.amount === 'bigint' ? channel.amount : BigInt(channel.amount.toString()),
        chain_id: channel.chainId,
        adjudicator: channel.adjudicator,
        challenge: channel.challenge,
        nonce: BigInt(channel.nonce),
        version: channel.version,
      };

      this.logger.debug('Processing individual channel', {
        component: 'ChannelService',
        channelId: dataToUpsert.channel_id,
        status: dataToUpsert.status,
        participant: dataToUpsert.participant,
      });

      await this.prisma.channel.upsert({
        where: { channel_id: dataToUpsert.channel_id },
        create: dataToUpsert,
        update: dataToUpsert,
      });
    }

    const duration = Date.now() - startTime;

    this.logger.log('Channel batch processing completed', {
      component: 'ChannelService',
      operation: 'process_channels',
      batchSize: channelsResponse.channels.length,
      duration: `${duration}ms`,
      averagePerChannel: `${Math.round(duration / channelsResponse.channels.length)}ms`,
    });
  }
}

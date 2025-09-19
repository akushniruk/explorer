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
      // API returns snake_case, handle both formats for compatibility
      const channelId = (channel as any).channel_id || channel.channelId;
      const chainId = (channel as any).chain_id || channel.chainId;
      const createdAtField = (channel as any).created_at || channel.createdAt;
      const updatedAtField = (channel as any).updated_at || channel.updatedAt;

      if (!channelId) {
        this.logger.warn('Skipping channel with missing channel_id', {
          component: 'ChannelService',
          channel: channel,
        });
        continue;
      }

      // Parse original dates from API
      const createdAt = createdAtField ? new Date(createdAtField) : undefined;
      const updatedAt = updatedAtField ? new Date(updatedAtField) : undefined;

      const dataToUpsert = {
        channel_id: channelId,
        participant: channel.participant,
        status: channel.status,
        token: channel.token,
        wallet: channel.wallet,
        amount:
          typeof channel.amount === 'bigint' ? channel.amount : BigInt(channel.amount.toString()),
        chain_id: chainId,
        adjudicator: channel.adjudicator,
        challenge: channel.challenge,
        nonce: BigInt(channel.nonce),
        version: channel.version,
        // Preserve original timestamps
        ...(createdAt && { created_at: createdAt }),
        ...(updatedAt && { updated_at: updatedAt }),
      };

      await this.prisma.channel.upsert({
        where: { channel_id: dataToUpsert.channel_id },
        create: dataToUpsert,
        update: {
          participant: dataToUpsert.participant,
          status: dataToUpsert.status,
          token: dataToUpsert.token,
          wallet: dataToUpsert.wallet,
          amount: dataToUpsert.amount,
          chain_id: dataToUpsert.chain_id,
          adjudicator: dataToUpsert.adjudicator,
          challenge: dataToUpsert.challenge,
          nonce: dataToUpsert.nonce,
          version: dataToUpsert.version,
          // Preserve updated_at from API, let Prisma handle if not provided
          ...(updatedAt && { updated_at: updatedAt }),
        },
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

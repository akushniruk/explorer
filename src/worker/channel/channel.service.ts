import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';
import { YellowApiService } from '../yellow-api.service';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yellowApi: YellowApiService,
  ) {}

  /**
   * Ensures that required assets exist before processing channels.
   * Fetches missing assets from the API and upserts them.
   */
  private async ensureAssetsExist(channels: GetChannelsResponseParams['channels']): Promise<void> {
    // Collect unique chain_ids from channels
    const chainIds = new Set<number>();

    for (const channel of channels) {
      const chainId = (channel as any).chain_id || channel.chainId;

      if (chainId !== undefined && chainId !== null) {
        chainIds.add(Number(chainId));
      }
    }

    // Fetch and upsert assets for each chain_id
    for (const chainId of chainIds) {
      try {
        const assetsResponse = await this.yellowApi.getAssets(chainId);

        if (!assetsResponse?.params?.assets || assetsResponse.params.assets.length === 0) {
          continue;
        }

        // Upsert assets in chunks
        const assets = assetsResponse.params.assets;
        const CHUNK_SIZE = 50;

        for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
          const chunk = assets.slice(i, i + CHUNK_SIZE);

          await this.prisma.$transaction(
            chunk.map((asset) =>
              this.prisma.asset.upsert({
                where: {
                  token_chain_id: {
                    token: asset.token,
                    chain_id: BigInt(asset.chainId),
                  },
                },
                create: {
                  token: asset.token,
                  chain_id: BigInt(asset.chainId),
                  symbol: asset.symbol?.trim().slice(0, 32) || '',
                  decimals: BigInt(asset.decimals),
                },
                update: {
                  symbol: asset.symbol?.trim().slice(0, 32) || '',
                  decimals: BigInt(asset.decimals),
                },
              }),
            ),
          );
        }

        this.logger.debug(`Ensured assets exist for chain_id ${chainId}`, {
          count: assets.length,
        });
      } catch (error) {
        this.logger.warn(`Failed to fetch/upsert assets for chain_id ${chainId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing - the channel upsert will fail if the asset is truly missing
      }
    }
  }

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

    // Ensure all required assets exist before processing channels
    await this.ensureAssetsExist(channelsResponse.channels);

    // Prepare all channel data first
    const channelsToUpsert: Array<{ dataToUpsert: any; updatedAt: Date | undefined }> = [];

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

      channelsToUpsert.push({ dataToUpsert, updatedAt });
    }

    // Batch upsert channels in chunks to reduce database round-trips
    const CHUNK_SIZE = 50;

    for (let i = 0; i < channelsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = channelsToUpsert.slice(i, i + CHUNK_SIZE);

      await this.prisma.$transaction(
        chunk.map(({ dataToUpsert, updatedAt }) =>
          this.prisma.channel.upsert({
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
          }),
        ),
      );
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

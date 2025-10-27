import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';
import { YellowApiService } from '../yellow-api.service';
import { CacheService } from '../../common/cache';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yellowApi: YellowApiService,
    private readonly cacheService: CacheService,
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

        // Bulk upsert assets using raw SQL
        const assets = assetsResponse.params.assets;
        const CHUNK_SIZE = 500;

        for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
          const chunk = assets.slice(i, i + CHUNK_SIZE);

          const values: string[] = [];
          const now = new Date().toISOString();

          chunk.forEach((asset) => {
            const symbol = (asset.symbol?.trim().slice(0, 32) || '').replace(/'/g, "''");
            values.push(
              `('${asset.token}', ${asset.chainId}, '${symbol}', ${asset.decimals}, '${now}', '${now}')`,
            );
          });

          const sql = `
            INSERT INTO "assets" ("token", "chain_id", "symbol", "decimals", "created_at", "updated_at")
            VALUES ${values.join(', ')}
            ON CONFLICT ("token", "chain_id")
            DO UPDATE SET
              "symbol" = EXCLUDED."symbol",
              "decimals" = EXCLUDED."decimals",
              "updated_at" = EXCLUDED."updated_at"
          `;

          await this.prisma.$executeRawUnsafe(sql);
        }

        this.logger.debug(`Ensured assets exist for chain_id ${chainId}`, {
          count: assets.length,
        });

        // Invalidate asset caches after updating
        await this.cacheService.invalidateAssets();
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

    // Check for duplicates within the batch
    const uniqueChannelIds = new Set(channelsToUpsert.map((c) => c.dataToUpsert.channel_id));
    const duplicatesInBatch = channelsToUpsert.length - uniqueChannelIds.size;

    if (duplicatesInBatch > 0) {
      this.logger.warn('Found duplicate channel IDs in the same batch', {
        totalRows: channelsToUpsert.length,
        uniqueIds: uniqueChannelIds.size,
        duplicates: duplicatesInBatch,
      });
    }

    // Bulk upsert channels using raw SQL to reduce database queries from N to 1 per chunk
    const CHUNK_SIZE = 500; // Increased chunk size since we're using bulk SQL

    for (let i = 0; i < channelsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = channelsToUpsert.slice(i, i + CHUNK_SIZE);

      // NOTE: We no longer pre-check which channels exist to avoid SELECT egress.
      // Postgres ON CONFLICT handles insert vs update efficiently with proper indexes.

      // Build VALUES clause for bulk insert
      const values: string[] = [];

      chunk.forEach(({ dataToUpsert }) => {
        const createdAt = dataToUpsert.created_at || new Date();
        const updatedAt = dataToUpsert.updated_at || new Date();

        values.push(
          `('${dataToUpsert.channel_id}', ${dataToUpsert.chain_id}, '${dataToUpsert.token}', '${dataToUpsert.wallet}', '${dataToUpsert.participant}', ${dataToUpsert.amount}, '${dataToUpsert.status}', ${dataToUpsert.challenge}, ${dataToUpsert.nonce}, ${dataToUpsert.version}, '${dataToUpsert.adjudicator}', '${createdAt.toISOString()}', '${updatedAt.toISOString()}')`,
        );
      });

      // Single bulk UPSERT query - reduces 500 queries to 1
      const sql = `
        INSERT INTO "channels" (
          "channel_id", "chain_id", "token", "wallet", "participant",
          "amount", "status", "challenge", "nonce", "version",
          "adjudicator", "created_at", "updated_at"
        )
        VALUES ${values.join(', ')}
        ON CONFLICT ("channel_id")
        DO UPDATE SET
          "participant" = EXCLUDED."participant",
          "status" = EXCLUDED."status",
          "token" = EXCLUDED."token",
          "wallet" = EXCLUDED."wallet",
          "amount" = EXCLUDED."amount",
          "chain_id" = EXCLUDED."chain_id",
          "adjudicator" = EXCLUDED."adjudicator",
          "challenge" = EXCLUDED."challenge",
          "nonce" = EXCLUDED."nonce",
          "version" = EXCLUDED."version",
          "updated_at" = EXCLUDED."updated_at"
      `;

      await this.prisma.$executeRawUnsafe(sql);

      this.logger.debug('Processed channels chunk', {
        chunkIndex: Math.floor(i / CHUNK_SIZE) + 1,
        chunkSize: chunk.length,
      });
    }

    const duration = Date.now() - startTime;

    this.logger.log('Channel batch processing completed', {
      component: 'ChannelService',
      operation: 'process_channels',
      totalProcessed: channelsResponse.channels.length,
      duplicatesInBatch,
      duration: `${duration}ms`,
      averagePerChannel: `${Math.round(duration / channelsResponse.channels.length)}ms`,
    });

    // Invalidate channel caches after successful processing
    await this.cacheService.invalidateChannels();
  }
}

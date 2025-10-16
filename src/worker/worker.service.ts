import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { YellowApiService } from './yellow-api.service';
import { ChannelService } from './channel/channel.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';
import { PrismaService } from '../prisma/prisma.service';
import { NodeConfigService } from './node-config/node-config.service';
import workerCfg from './worker.config';
import { ConfigType } from '@nestjs/config';
import { AssetService } from './asset/asset.service';
import { HealthService } from './health/health.service';
import { AppSessionService } from './app-session/app-session.service';

const JOB_ID = 'channels-sync';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private isSyncing = false;
  private lastAssetsSyncMs = 0;
  private lastAppSessionsSyncMs = 0;
  private lastChannelsSyncMs = 0;

  constructor(
    private readonly yellowApiService: YellowApiService,
    private readonly channelService: ChannelService,
    private readonly prisma: PrismaService,
    private readonly nodeConfigService: NodeConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly assetService: AssetService,
    private readonly healthService: HealthService,
    private readonly appSessionService: AppSessionService,
    @Inject(workerCfg.KEY) private readonly cfg: ConfigType<typeof workerCfg>,
  ) {}

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async onModuleInit() {
    // Ensure WS is open before first upstream calls
    try {
      await this.yellowApiService.waitUntilOpen(this.cfg.wsRequestTimeoutMs ?? 5_000);
    } catch (e) {
      this.logger.warn(`WS not open yet; continuing: ${(e as Error).message}`);
    }

    // Force a real config fetch on boot (persists to DB)
    await this.nodeConfigService.warm({ forceFetch: true });

    try {
      const h = await this.healthService.check();

      if (h.status === 'down') {
        this.logger.warn('Upstream is down at boot; warm-ups may fail', { latencyMs: h.latencyMs });
      }
    } catch {
      /* noop */
    }

    try {
      const res = await this.assetService.syncAssets(); // all chains

      this.lastAssetsSyncMs = Date.now();
      this.logger.log('Initial assets warm-up done', { count: res.count });
    } catch (e) {
      this.logger.warn(`Initial assets warm-up failed: ${(e as Error).message}`);
    }

    try {
      const res = await this.appSessionService.syncAllWithBudget();

      this.lastAppSessionsSyncMs = Date.now();
      this.logger.log('Initial app sessions warm-up done', { count: res.count });
    } catch (e) {
      this.logger.warn(`Initial app sessions warm-up failed: ${(e as Error).message}`);
    }

    // Initial channels sync
    try {
      await this.syncChannels();
      this.lastChannelsSyncMs = Date.now();
      this.logger.log('Initial channels warm-up done');
    } catch (e) {
      this.logger.warn(`Initial channels warm-up failed: ${(e as Error).message}`);
    }

    const intervalMs = Math.max(Number(this.cfg?.sync?.intervalMs ?? 90_000), 1_000);
    const batchSize = Number(this.cfg?.sync?.channelsLimit ?? 100);

    this.logger.log('Worker service initialized', {
      component: 'WorkerService',
      action: 'startup',
      syncIntervalMs: intervalMs,
      batchSize,
      mode: 'full-refresh',
    });

    const handle = setInterval(() => void this.handleSync(), intervalMs);

    this.scheduler.addInterval(JOB_ID, handle);
    this.logger.log(`Scheduled ${JOB_ID} every ${intervalMs}ms`);
  }

  onModuleDestroy() {
    try {
      const handle = this.scheduler.getInterval(JOB_ID);

      clearInterval(handle as NodeJS.Timeout);
      this.scheduler.deleteInterval(JOB_ID);
    } catch {
      /* noop */
    }
  }

  async handleSync(): Promise<void> {
    const health = await this.healthService.check();

    if (health.status !== 'healthy') {
      this.logger.warn('Skipping sync: upstream unhealthy', { latencyMs: health.latencyMs });

      return;
    }

    if (this.isSyncing) {
      this.logger.warn('Sync already in progress; skipping this tick', {
        component: 'WorkerService',
        operation: 'sync',
      });

      return;
    }

    this.isSyncing = true;

    try {
      // Periodic assets refresh
      const assetsRefreshMs = Number(this.cfg?.sync?.assetsRefreshMs ?? 30 * 60 * 1000); // 30m

      if (Date.now() - this.lastAssetsSyncMs >= assetsRefreshMs) {
        try {
          const res = await this.assetService.syncAssets();

          this.lastAssetsSyncMs = Date.now();
          this.logger.log('Periodic assets refresh completed', { count: res.count });
        } catch (e) {
          this.logger.warn(`Periodic assets refresh failed: ${(e as Error).message}`);
        }
      }

      // Periodic app sessions refresh
      const appSessionsRefreshMs = Number(this.cfg?.sync?.appSessionsRefreshMs ?? 300_000);

      if (Date.now() - this.lastAppSessionsSyncMs >= appSessionsRefreshMs) {
        try {
          const res = await this.appSessionService.syncAllWithBudget();

          this.lastAppSessionsSyncMs = Date.now();
          this.logger.log('Periodic app sessions refresh completed', { count: res.count });
        } catch (e) {
          this.logger.warn(`Periodic app sessions refresh failed: ${(e as Error).message}`);
        }
      }

      // Periodic channels refresh - always run full sync
      const channelsRefreshMs = Number(this.cfg?.sync?.channelsRefreshMs ?? 300_000); // 5m default

      if (Date.now() - this.lastChannelsSyncMs >= channelsRefreshMs) {
        try {
          await this.syncChannels();
          this.lastChannelsSyncMs = Date.now();
          this.logger.log('Periodic channels refresh completed');
        } catch (e) {
          this.logger.warn(`Periodic channels refresh failed: ${(e as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.error('Synchronization failed', {
        component: 'WorkerService',
        operation: 'sync',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Full refresh of all channels - fetches and upserts all channels from the API.
   * This ensures updates to existing channels are captured, not just new ones.
   */
  private async syncChannels(): Promise<void> {
    const startTime = Date.now();
    const limit = Number(this.cfg?.sync?.channelsLimit ?? 100);
    const budgetMs = Number(this.cfg?.sync?.channelsBudgetMs ?? 60_000); // 1 minute default
    const sleepMs = Number(this.cfg?.sync?.channelsSleepMs ?? 1000);

    this.logger.log('Started full channels synchronization', {
      operation: 'channels_sync',
      batchSize: limit,
      budgetMs,
    });

    let offset = 0;
    let totalChannelsProcessed = 0;

    while (Date.now() - startTime < budgetMs) {
      let channelsResponse: GetChannelsResponseParams | undefined;

      try {
        const response = await this.yellowApiService.getChannels({ limit, offset, sort: 'desc' });

        channelsResponse = response.params;
      } catch (e) {
        this.logger.warn('Upstream unavailable during channel sync; aborting this cycle', {
          error: (e as Error).message,
          offset,
          limit,
        });
        break;
      }

      if (!channelsResponse || !channelsResponse.channels || channelsResponse.channels.length === 0)
        break;

      await this.channelService.processChannels(channelsResponse);
      totalChannelsProcessed += channelsResponse.channels.length;

      if (channelsResponse.channels.length < limit) break;

      offset += limit;

      if (sleepMs > 0) await this.sleep(sleepMs);
    }

    const duration = Date.now() - startTime;

    this.logger.log('Full channels synchronization completed', {
      operation: 'channels_sync',
      channelsProcessed: totalChannelsProcessed,
      durationMs: duration,
    });
  }
}

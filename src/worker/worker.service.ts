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

const WORKER_STATE_KEY = 'channels:last_ts';
const JOB_ID = 'channels-sync';

type ChannelCursor = { t: number; id: string }; // ms + channelId
const encodeCursor = (c: ChannelCursor) => `${c.t}:${c.id}`;
const decodeCursor = (s: string): ChannelCursor => {
  const i = s.indexOf(':');

  if (i <= 0) throw new Error(`Bad cursor format: ${s}`);

  const t = Number(s.slice(0, i));
  const id = s.slice(i + 1);

  if (!Number.isFinite(t)) throw new Error(`Bad cursor timestamp: ${s}`);

  return { t, id };
};
const compareCursor = (a: ChannelCursor, b: ChannelCursor) =>
  a.t !== b.t ? a.t - b.t : a.id.localeCompare(b.id);

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private latestCursor: ChannelCursor | null = null;
  private isInitialSyncComplete = false;
  private isSyncing = false;
  private lastAssetsSyncMs = 0;
  private lastAppSessionsSyncMs = 0;

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

    // Load persisted cursor (composite)
    this.latestCursor = await this.loadCursor();
    this.isInitialSyncComplete = !!this.latestCursor;

    const intervalMs = Math.max(Number(this.cfg?.sync?.intervalMs ?? 90_000), 1_000);
    const batchSize = Number(this.cfg?.sync?.channelsLimit ?? 100);

    this.logger.log('Worker service initialized', {
      component: 'WorkerService',
      action: 'startup',
      syncIntervalMs: intervalMs,
      batchSize,
      mode: this.isInitialSyncComplete ? 'incremental' : 'full',
      cursor: this.latestCursor ? encodeCursor(this.latestCursor) : null,
    });

    const handle = setInterval(() => void this.handleSync(), intervalMs);

    this.scheduler.addInterval(JOB_ID, handle);
    this.logger.log(`Scheduled ${JOB_ID} every ${intervalMs}ms`);

    await this.handleSync();
  }

  onModuleDestroy() {
    try {
      const handle = this.scheduler.getInterval(JOB_ID);

      clearInterval(handle);
      this.scheduler.deleteInterval(JOB_ID);
    } catch {
      /* noop */
    }
  }

  async handleSync(): Promise<void> {
    const assetsRefreshMs = Number(this.cfg?.sync?.assetsRefreshMs ?? 30 * 60 * 1000); // 30m

    const health = await this.healthService.check();

    if (health.status !== 'healthy') {
      this.logger.warn('Skipping sync: upstream unhealthy', { latencyMs: health.latencyMs });

      return;
    }

    if (Date.now() - this.lastAssetsSyncMs >= assetsRefreshMs) {
      try {
        const res = await this.assetService.syncAssets();

        this.lastAssetsSyncMs = Date.now();
        this.logger.log('Periodic assets refresh completed', { count: res.count });
      } catch (e) {
        this.logger.warn(`Periodic assets refresh failed: ${(e as Error).message}`);
      }
    }

    const ttl = Number(this.cfg?.sync?.appSessionsRefreshMs ?? 300_000);

    if (Date.now() - this.lastAppSessionsSyncMs >= ttl) {
      try {
        const res = await this.appSessionService.syncAllWithBudget();

        this.lastAppSessionsSyncMs = Date.now();
        this.logger.log('Periodic app sessions refresh completed', { count: res.count });
      } catch (e) {
        this.logger.warn(`Periodic app sessions refresh failed: ${(e as Error).message}`);
      }
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
      if (!this.isInitialSyncComplete) {
        await this.runFullSync();
      } else {
        await this.runIncrementalSync();
      }
    } catch (error) {
      this.logger.error('Channel synchronization failed', {
        component: 'WorkerService',
        operation: this.isInitialSyncComplete ? 'incremental_sync' : 'full_sync',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async runFullSync(): Promise<void> {
    const startTime = Date.now();
    const limit = Number(this.cfg?.sync?.channelsLimit ?? 100);
    const sleepMs = Number(this.cfg?.sync?.fullSleepMs ?? 3000);

    this.logger.log('Started full channel synchronization', {
      operation: 'full_sync',
      batchSize: limit,
    });

    let offset = 0;
    let newestCursor: ChannelCursor | null = null;
    let totalChannelsProcessed = 0;

    while (true) {
      let channels: GetChannelsResponseParams | undefined;

      try {
        const response = await this.yellowApiService.getChannels({ limit, offset, sort: 'desc' });

        channels = response.params;
      } catch (e) {
        this.logger.warn('Upstream unavailable during full sync; aborting this cycle', {
          error: (e as Error).message,
          offset,
          limit,
        });
        break;
      }

      if (!channels || channels.length === 0) break;

      if (offset === 0) {
        const top = channels[0];

        newestCursor = { t: new Date(top.createdAt).getTime(), id: top.channelId };
      }

      await this.channelService.processChannels(channels);
      totalChannelsProcessed += channels.length;

      if (channels.length < limit) break;

      offset += limit;

      if (sleepMs > 0) await this.sleep(sleepMs);
    }

    const duration = Date.now() - startTime;

    if (newestCursor) {
      await this.saveCursor(newestCursor);
      this.latestCursor = newestCursor;
      this.isInitialSyncComplete = true;
    } else {
      this.isInitialSyncComplete = false;
    }

    this.logger.log('Full channel synchronization completed', {
      operation: 'full_sync',
      channelsProcessed: totalChannelsProcessed,
      durationMs: duration,
      latestCursor: this.latestCursor ? encodeCursor(this.latestCursor) : null,
    });
  }

  private async runIncrementalSync(): Promise<void> {
    const limit = Number(this.cfg?.sync?.channelsLimit ?? 100);

    if (!this.latestCursor) {
      this.logger.error('Incremental sync prerequisite not met', {
        component: 'WorkerService',
        operation: 'incremental_sync',
        error: 'Missing cursor; initial sync must complete first',
        isInitialSyncComplete: this.isInitialSyncComplete,
      });

      return;
    }

    const cur = this.latestCursor;
    const startTime = Date.now();
    const allNewChannels: GetChannelsResponseParams = [];

    this.logger.log('Started incremental channel synchronization', {
      operation: 'incremental_sync',
      lastCursor: encodeCursor(cur),
    });

    let offset = 0;
    let nextCursor: ChannelCursor | null = null;

    while (true) {
      let respParams: GetChannelsResponseParams | undefined;

      try {
        const response = await this.yellowApiService.getChannels({ limit, offset, sort: 'desc' });

        respParams = response.params;
      } catch (e) {
        this.logger.warn('Upstream unavailable during incremental sync; aborting this cycle', {
          error: (e as Error).message,
          offset,
          limit,
        });
        break;
      }

      if (!respParams || respParams.length === 0) break;

      const page =
        respParams.filter((c) => {
          const t = new Date(c.createdAt).getTime();

          return compareCursor({ t, id: c.channelId }, cur) > 0;
        }) || [];

      if (page.length > 0 && !nextCursor) {
        const top = page[0];

        nextCursor = { t: new Date(top.createdAt).getTime(), id: top.channelId };
      }

      allNewChannels.push(...page);

      if (respParams.length < limit || page.length === 0) break;

      offset += limit;
    }

    const duration = Date.now() - startTime;

    if (allNewChannels.length > 0 && nextCursor) {
      this.logger.log('Incremental channel synchronization completed', {
        operation: 'incremental_sync',
        newChannels: allNewChannels.length,
        durationMs: duration,
        latestCursor: encodeCursor(nextCursor),
      });

      await this.channelService.processChannels(allNewChannels);
      await this.saveCursor(nextCursor);
      this.latestCursor = nextCursor;
    } else {
      this.logger.log('Incremental synchronization completed with no new channels', {
        operation: 'incremental_sync',
        newChannels: 0,
        durationMs: duration,
        lastCursor: encodeCursor(cur),
      });
    }
  }

  // ---------- cursor persistence ----------

  private async loadCursor(): Promise<ChannelCursor | null> {
    try {
      const row = await this.prisma.workerState.findUnique({ where: { id: WORKER_STATE_KEY } });

      if (!row) return null;

      const rawCursor: string | null = (row as any).cursor ?? null;

      if (rawCursor) return decodeCursor(rawCursor);

      // legacy fallback
      const ms = Number(row.lastProcessedTimestamp);

      if (!Number.isFinite(ms) || ms <= 0) return null;

      return { t: ms, id: '' };
    } catch (e) {
      this.logger.warn(`Failed to load worker state: ${(e as Error).message}`);

      return null;
    }
  }

  private async saveCursor(c: ChannelCursor): Promise<void> {
    try {
      await this.prisma.workerState.upsert({
        where: { id: WORKER_STATE_KEY },
        update: { lastProcessedTimestamp: BigInt(c.t), cursor: encodeCursor(c) },
        create: {
          id: WORKER_STATE_KEY,
          lastProcessedTimestamp: BigInt(c.t),
          cursor: encodeCursor(c),
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to persist worker state: ${(e as Error).message}`);
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { YellowApiService } from './yellow-api.service';
import { ChannelService } from './channel/channel.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private latestKnownChannelTimestamp: Date | null = null;
  private isInitialSyncComplete = false;
  private isSyncing = false;

  constructor(
    private readonly yellowApiService: YellowApiService,
    private readonly channelService: ChannelService,
  ) {}

  async onModuleInit() {
    this.logger.log('Worker service initialized successfully', {
      component: 'WorkerService',
      action: 'startup',
      syncInterval: '90s',
    });
    await this.handleSync();
  }

  @Interval(90000)
  async handleSync(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('Sync operation already in progress, skipping scheduled interval', {
        component: 'WorkerService',
        operation: 'sync',
        interval: '90s',
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
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async runFullSync(): Promise<void> {
    const startTime = Date.now();

    this.logger.log('Started full channel synchronization', {
      operation: 'full_sync',
      batchSize: 100,
      startTime: new Date().toISOString(),
    });
    let offset = 0;
    const limit = 100;
    let newestTimestampInSync: Date | null = null;
    let totalChannelsProcessed = 0;

    while (true) {
      const response = await this.yellowApiService.getChannels({
        limit,
        offset,
        sort: 'desc',
      });
      const channels = response.params;

      if (!channels || channels.length === 0) break;

      if (offset === 0 && channels.length > 0) {
        newestTimestampInSync = new Date(channels[0].createdAt);
      }

      await this.channelService.processChannels(channels);
      totalChannelsProcessed += channels.length;

      if (channels.length < limit) break;

      offset += limit;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const duration = Date.now() - startTime;

    this.latestKnownChannelTimestamp = newestTimestampInSync;
    this.isInitialSyncComplete = true;
    this.logger.log('Full channel synchronization completed', {
      operation: 'full_sync',
      channelsProcessed: totalChannelsProcessed,
      duration: `${duration}ms`,
      latestChannelDate: this.latestKnownChannelTimestamp?.toISOString(),
      timestamp: new Date().toISOString(),
    });
  }

  private async runIncrementalSync(): Promise<void> {
    let offset = 0;
    const limit = 100;

    if (!this.latestKnownChannelTimestamp) {
      this.logger.error('Incremental sync prerequisite not met', {
        component: 'WorkerService',
        operation: 'incremental_sync',
        error: 'Initial sync must complete first',
        isInitialSyncComplete: this.isInitialSyncComplete,
      });

      return;
    }

    const lastSyncTimestamp = this.latestKnownChannelTimestamp;

    const startTime = Date.now();

    this.logger.log('Started incremental channel synchronization', {
      operation: 'incremental_sync',
      lastSyncDate: lastSyncTimestamp.toISOString(),
      startTime: new Date().toISOString(),
    });
    const allNewChannels: GetChannelsResponseParams = [];

    while (true) {
      const response = await this.yellowApiService.getChannels({
        limit,
        offset,
        sort: 'desc',
      });
      const page = response.params?.filter((c) => new Date(c.createdAt) > lastSyncTimestamp) || [];

      allNewChannels.push(...page);

      if (!response.params || response.params.length < limit || page.length < limit) break;

      offset += limit;
    }

    const duration = Date.now() - startTime;

    if (allNewChannels.length > 0) {
      this.logger.log('Incremental channel synchronization completed', {
        operation: 'incremental_sync',
        newChannels: allNewChannels.length,
        duration: `${duration}ms`,
        latestChannelDate: new Date(allNewChannels[0].createdAt).toISOString(),
      });
      this.latestKnownChannelTimestamp = new Date(allNewChannels[0].createdAt);
      await this.channelService.processChannels(allNewChannels);
    } else {
      this.logger.log('Incremental synchronization completed with no new channels', {
        operation: 'incremental_sync',
        newChannels: 0,
        duration: `${duration}ms`,
        lastCheckedDate: lastSyncTimestamp.toISOString(),
      });
    }
  }
}

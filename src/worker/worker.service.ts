import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { YellowApiService } from './yellow-api.service';
import { ChannelService } from './channel/channel.service'; // <-- Import ChannelService
import { GetChannelsResponseParams } from '@erc7824/nitrolite';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private latestKnownChannelTimestamp: Date | null = null;
  private isInitialSyncComplete = false;
  private isSyncing = false;

  constructor(
    private readonly yellowApiService: YellowApiService,
    private readonly channelService: ChannelService, // <-- Inject ChannelService
  ) {}

  async onModuleInit() {
    this.logger.log('WorkerService initialized. Starting initial sync immediately.');
    await this.handleSync();
  }

  @Interval(60000)
  async handleSync(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress. Skipping this interval.');

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
      this.logger.error('An error occurred during the sync process.', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async runFullSync(): Promise<void> {
    this.logger.log('Starting initial full sync of all channels...');
    let offset = 0;
    const limit = 100;
    let newestTimestampInSync: Date | null = null;

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

      // Delegate processing to the ChannelService
      await this.channelService.processChannels(channels);

      if (channels.length < limit) break;

      offset += limit;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    this.latestKnownChannelTimestamp = newestTimestampInSync;
    this.isInitialSyncComplete = true;
    this.logger.log(
      `Initial sync complete. Newest channel: ${this.latestKnownChannelTimestamp?.toISOString()}`,
    );
  }

  private async runIncrementalSync(): Promise<void> {
    let offset = 0;
    const limit = 100;

    if (!this.latestKnownChannelTimestamp) {
      this.logger.error('Cannot run incremental sync: initial sync must complete first.');

      return;
    }

    const lastSyncTimestamp = this.latestKnownChannelTimestamp;

    this.logger.log('Checking for new channels...');
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

    if (allNewChannels.length > 0) {
      this.logger.log(`Found ${allNewChannels.length} new channels.`);
      this.latestKnownChannelTimestamp = new Date(allNewChannels[0].createdAt);
      await this.channelService.processChannels(allNewChannels);
    } else {
      this.logger.log('No new channels found.');
    }
  }
}

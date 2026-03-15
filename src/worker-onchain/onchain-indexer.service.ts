import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChainProcessorService } from './chain-processor.service';
import workerOnchainCfg from './worker-onchain.config';

const JOB_ID = 'onchain-indexer-sync';

@Injectable()
export class OnchainIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OnchainIndexerService.name);
  private isSyncing = false;
  private warnedMissingTable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
    private readonly chainProcessor: ChainProcessorService,
    @Inject(workerOnchainCfg.KEY) private readonly cfg: ConfigType<typeof workerOnchainCfg>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.cfg.enabled) {
      this.logger.log('Onchain indexer disabled (ONCHAIN_INDEXER_ENABLED=false)');

      return;
    }

    const intervalMs = Math.max(Number(this.cfg.syncIntervalMs ?? 30_000), 5_000);
    const handle = setInterval(() => void this.handleSyncTick(), intervalMs);

    this.scheduler.addInterval(JOB_ID, handle);
    this.logger.log('Onchain indexer scheduled', {
      syncIntervalMs: intervalMs,
      maxChainsPerTick: this.cfg.maxChainsPerTick,
    });

    await this.handleSyncTick();
  }

  onModuleDestroy(): void {
    try {
      const handle = this.scheduler.getInterval(JOB_ID);

      clearInterval(handle as NodeJS.Timeout);
      this.scheduler.deleteInterval(JOB_ID);
    } catch {
      /* noop */
    }
  }

  async handleSyncTick(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('Onchain sync already in progress; skipping tick');

      return;
    }

    this.isSyncing = true;

    try {
      const maxChains = Math.max(Number(this.cfg.maxChainsPerTick ?? 10), 1);
      const chains = await this.prisma.onchainChainConfig.findMany({
        where: { enabled: true },
        orderBy: { chain_id: 'asc' },
        take: maxChains,
      });

      this.warnedMissingTable = false;

      if (chains.length === 0) {
        this.logger.debug('No enabled onchain chain configs');

        return;
      }

      for (const chain of chains) {
        await this.chainProcessor.processChain(chain);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const relationMissing =
        message.includes('onchain_chain_configs') &&
        message.toLowerCase().includes('does not exist');

      if (relationMissing) {
        if (!this.warnedMissingTable) {
          this.logger.warn(
            'Onchain tables are not migrated yet. Run Prisma migrations before enabling indexer.',
          );
          this.warnedMissingTable = true;
        }
      } else {
        this.logger.error('Onchain sync tick failed', message);
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

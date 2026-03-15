import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createPublicClient, http } from 'viem';
import type { Address, Log, PublicClient } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { EventDecoderService, type IndexedEvent } from './event-decoder.service';
import workerOnchainCfg from './worker-onchain.config';

const WINDOW_START_BLOCKS = 1500n;
const WINDOW_MIN_BLOCKS = 100n;
const WINDOW_MAX_BLOCKS = 5000n;

const INFURA_NETWORK_BY_CHAIN_ID: Record<number, string> = {
  1: 'mainnet',
  137: 'polygon-mainnet',
  80002: 'polygon-amoy',
  11155111: 'sepolia',
};

export type ChainConfig = {
  chain_id: bigint;
  channel_hub_address: string;
  enabled: boolean;
  start_block: bigint | null;
  last_synced_block: bigint | null;
};

type RpcClient = Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getBlock'>;

@Injectable()
export class ChainProcessorService {
  private readonly logger = new Logger(ChainProcessorService.name);
  private readonly chainWindowSizes = new Map<string, bigint>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly decoder: EventDecoderService,
    @Inject(workerOnchainCfg.KEY) private readonly cfg: ConfigType<typeof workerOnchainCfg>,
  ) {}

  async processChain(chain: ChainConfig): Promise<void> {
    const chainId = chain.chain_id.toString();
    const rpcUrl = this.resolveRpcUrl(chain.chain_id);

    if (!rpcUrl) {
      this.logger.warn('Skipping onchain chain: no Infura API key or unsupported chain', {
        chainId,
      });

      return;
    }

    const fromBlock = this.resolveFromBlock(chain);

    if (fromBlock === null) {
      this.logger.warn('Skipping onchain chain: start_block/last_synced_block is missing', {
        chainId,
      });

      return;
    }

    const client = this.createRpcClient(rpcUrl);
    const latestBlock = await client.getBlockNumber();

    if (fromBlock > latestBlock) {
      this.logger.debug('Onchain chain has no new blocks', {
        chainId,
        fromBlock: fromBlock.toString(),
        latestBlock: latestBlock.toString(),
      });

      return;
    }

    const windowSize = this.getWindowSize(chain.chain_id);
    const toBlock = fromBlock + windowSize - 1n < latestBlock ? fromBlock + windowSize - 1n : latestBlock;

    let logs: Log[];

    try {
      logs = await (client as any).getLogs({
        address: chain.channel_hub_address as Address,
        fromBlock,
        toBlock,
        topics: [this.decoder.trackedEventSelectors],
      });
    } catch (error) {
      const shrunkWindow = this.shrinkWindow(chain.chain_id);

      this.logger.warn('Onchain RPC fetch failed; shrinking block window', {
        chainId,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        nextWindowSize: shrunkWindow.toString(),
        error: error instanceof Error ? error.message : String(error),
      });

      return;
    }

    const completedFully = await this.processBlockRange(chain, client, fromBlock, toBlock, logs);

    if (completedFully) {
      const grownWindow = this.growWindow(chain.chain_id);

      this.logger.debug('Onchain chain window processed', {
        chainId,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        logs: logs.length,
        nextWindowSize: grownWindow.toString(),
      });
    }
  }

  private async processBlockRange(
    chain: ChainConfig,
    client: RpcClient,
    fromBlock: bigint,
    toBlock: bigint,
    logs: Log[],
  ): Promise<boolean> {
    const logsByBlock = this.decoder.groupLogsByBlock(this.decoder.filterMinedLogs(logs));
    const baseline = chain.last_synced_block ?? (fromBlock > 0n ? fromBlock - 1n : 0n);
    let highWatermark = baseline;

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1n) {
      const blockLogs = logsByBlock.get(blockNumber.toString()) ?? [];

      if (blockLogs.length === 0) {
        highWatermark = blockNumber;
        continue;
      }

      try {
        const block = await client.getBlock({ blockNumber });
        const blockTimestamp = new Date(Number(block.timestamp) * 1000);
        const events: IndexedEvent[] = [];

        for (const log of blockLogs) {
          const decoded = this.decoder.decodeLog(log);

          if (decoded) {
            events.push(decoded);
          }
        }

        await this.persistBlock(chain.chain_id, blockNumber, blockTimestamp, events);
        highWatermark = blockNumber;
      } catch (error) {
        if (highWatermark > baseline) {
          await this.advanceCursor(chain.chain_id, highWatermark);
        }

        this.logger.error('Failed processing onchain block; chain tick stopped at last committed block', {
          chainId: chain.chain_id.toString(),
          failedBlock: blockNumber.toString(),
          lastCommittedBlock: highWatermark.toString(),
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }
    }

    if (highWatermark > baseline) {
      await this.advanceCursor(chain.chain_id, highWatermark);
    }

    return true;
  }

  private async persistBlock(
    chainId: bigint,
    blockNumber: bigint,
    blockTimestamp: Date,
    events: IndexedEvent[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const event of events) {
        await tx.onchainEvent.upsert({
          where: {
            chain_id_tx_hash_log_index: {
              chain_id: chainId,
              tx_hash: event.txHash,
              log_index: event.logIndex,
            },
          },
          create: {
            chain_id: chainId,
            contract_address: event.contractAddress,
            tx_hash: event.txHash,
            log_index: event.logIndex,
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            event_name: event.eventName,
            channel_id: event.channelId,
            user_wallet: event.userWallet,
            node_address: event.nodeAddress,
            raw_payload: event.rawPayload,
          },
          update: {
            block_timestamp: blockTimestamp,
            event_name: event.eventName,
            channel_id: event.channelId,
            user_wallet: event.userWallet,
            node_address: event.nodeAddress,
            raw_payload: event.rawPayload,
          },
        });
      }

      await tx.onchainChainConfig.update({
        where: { chain_id: chainId },
        data: { last_synced_block: blockNumber },
      });
    });
  }

  private async advanceCursor(chainId: bigint, blockNumber: bigint): Promise<void> {
    await this.prisma.onchainChainConfig.update({
      where: { chain_id: chainId },
      data: { last_synced_block: blockNumber },
    });
  }

  resolveRpcUrl(chainId: bigint): string | null {
    if (!this.cfg.infuraApiKey) {
      return null;
    }

    const network = INFURA_NETWORK_BY_CHAIN_ID[Number(chainId)];

    return network ? `https://${network}.infura.io/v3/${this.cfg.infuraApiKey}` : null;
  }

  createRpcClient(rpcUrl: string): RpcClient {
    return createPublicClient({
      transport: http(rpcUrl, { timeout: 15_000, retryCount: 0 }),
    });
  }

  private resolveFromBlock(chain: ChainConfig): bigint | null {
    if (chain.last_synced_block !== null) {
      return chain.last_synced_block + 1n;
    }

    return chain.start_block ?? null;
  }

  private getWindowSize(chainId: bigint): bigint {
    return this.chainWindowSizes.get(chainId.toString()) ?? WINDOW_START_BLOCKS;
  }

  shrinkWindow(chainId: bigint): bigint {
    const key = chainId.toString();
    const current = this.getWindowSize(chainId);
    const next = current / 2n > WINDOW_MIN_BLOCKS ? current / 2n : WINDOW_MIN_BLOCKS;

    this.chainWindowSizes.set(key, next);

    return next;
  }

  private growWindow(chainId: bigint): bigint {
    const key = chainId.toString();
    const current = this.getWindowSize(chainId);
    const next = current * 2n < WINDOW_MAX_BLOCKS ? current * 2n : WINDOW_MAX_BLOCKS;

    this.chainWindowSizes.set(key, next);

    return next;
  }
}

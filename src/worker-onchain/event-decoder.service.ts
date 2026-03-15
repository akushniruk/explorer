import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { decodeEventLog, getAbiItem, toEventSelector } from 'viem';
import type { Abi, Hex, Log } from 'viem';
import type { Prisma } from '@prisma/client';

const TARGET_EVENTS = [
  'ChannelCreated',
  'ChannelDeposited',
  'ChannelWithdrawn',
  'ChannelCheckpointed',
  'ChannelChallenged',
  'ChannelClosed',
] as const;

export type MinedLog = Log & {
  blockNumber: bigint;
  logIndex: number | bigint;
  transactionHash: Hex;
};

export type IndexedEvent = {
  eventName: string;
  channelId: string | null;
  userWallet: string | null;
  nodeAddress: string | null;
  txHash: string;
  logIndex: number;
  contractAddress: string;
  rawPayload: Prisma.InputJsonValue;
};

@Injectable()
export class EventDecoderService {
  private readonly channelHubAbi: Abi;
  private readonly trackedEventNames = new Set<string>(TARGET_EVENTS);
  readonly trackedEventSelectors: Hex[];

  constructor() {
    this.channelHubAbi = this.loadChannelHubAbi();
    this.trackedEventSelectors = this.buildTrackedEventSelectors();
  }

  decodeLog(log: MinedLog): IndexedEvent | null {
    if (log.topics.length === 0) {
      return null;
    }

    const decoded = decodeEventLog({
      abi: this.channelHubAbi,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
      strict: false,
    });

    const eventName = decoded?.eventName;

    if (!eventName || !this.trackedEventNames.has(eventName)) {
      return null;
    }

    const args = this.toRecord(decoded.args);

    return {
      eventName,
      channelId: this.extractString(args, ['channelId', 'channel_id']),
      userWallet: this.extractAddress(args, ['user', 'wallet', 'participant', 'account']),
      nodeAddress: this.extractAddress(args, ['node', 'nodeAddress', 'broker']),
      txHash: String(log.transactionHash),
      logIndex: typeof log.logIndex === 'bigint' ? Number(log.logIndex) : log.logIndex,
      contractAddress: String(log.address),
      rawPayload: this.toJsonSafe({ decoded: { eventName, args: decoded.args }, log }),
    };
  }

  filterMinedLogs(logs: Log[]): MinedLog[] {
    return logs.filter(
      (log): log is MinedLog =>
        log.blockNumber !== null && log.logIndex !== null && log.transactionHash !== null,
    );
  }

  groupLogsByBlock(logs: MinedLog[]): Map<string, MinedLog[]> {
    const sorted = [...logs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }

      if (a.logIndex !== b.logIndex) {
        return a.logIndex < b.logIndex ? -1 : 1;
      }

      return 0;
    });

    const grouped = new Map<string, MinedLog[]>();

    for (const log of sorted) {
      const key = log.blockNumber.toString();
      const existing = grouped.get(key);

      if (existing) {
        existing.push(log);
      } else {
        grouped.set(key, [log]);
      }
    }

    return grouped;
  }

  private buildTrackedEventSelectors(): Hex[] {
    return Array.from(this.trackedEventNames).map((eventName) => {
      const abiItem = getAbiItem({ abi: this.channelHubAbi, name: eventName });

      if (!abiItem || abiItem.type !== 'event') {
        throw new Error(`Event ${eventName} not found in ChannelHub ABI`);
      }

      return toEventSelector(abiItem);
    });
  }

  private loadChannelHubAbi(): Abi {
    const candidates = [
      join(__dirname, 'abi', 'ChannelHub.json'),
      join(process.cwd(), 'src', 'worker-onchain', 'abi', 'ChannelHub.json'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return JSON.parse(readFileSync(candidate, 'utf8')) as Abi;
      }
    }

    throw new Error('ChannelHub ABI not found at src/worker-onchain/abi/ChannelHub.json');
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private extractString(args: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = args[key];

      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private extractAddress(args: Record<string, unknown>, keys: string[]): string | null {
    const value = this.extractString(args, keys);

    return value ? value.toLowerCase() : null;
  }

  private toJsonSafe(input: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(input, (_, value) => (typeof value === 'bigint' ? value.toString() : value)),
    ) as Prisma.InputJsonValue;
  }
}

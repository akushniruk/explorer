import { CacheModuleOptions } from '@nestjs/cache-manager';

/**
 * Cache TTL Configuration (in milliseconds)
 *
 * These values determine how long data is cached in memory
 * before being refreshed from the database.
 */
export const CACHE_TTL = {
  /** Channels change frequently with new deposits/withdrawals - 2 minutes */
  CHANNELS: 2 * 60 * 1000,

  /** Individual channel details - 2 minutes */
  CHANNEL_DETAIL: 2 * 60 * 1000,

  /** Wallet/participant lookups are expensive - cache 3 minutes */
  CHANNEL_BY_ADDRESS: 3 * 60 * 1000,

  /** Assets rarely change - 30 minutes */
  ASSETS: 30 * 60 * 1000,

  /** Asset details are very static - 1 hour */
  ASSET_DETAIL: 60 * 60 * 1000,

  /** Networks almost never change - 1 hour */
  NETWORKS: 60 * 60 * 1000,

  /** Network details are static - 1 hour */
  NETWORK_DETAIL: 60 * 60 * 1000,

  /** App sessions update moderately - 5 minutes */
  APP_SESSIONS: 5 * 60 * 1000,

  /** Session details - 5 minutes */
  APP_SESSION_DETAIL: 5 * 60 * 1000,

  /** Nodes are relatively static - 15 minutes */
  NODES: 15 * 60 * 1000,

  /** Node details - 15 minutes */
  NODE_DETAIL: 15 * 60 * 1000,

  /** Node config is very static - 30 minutes */
  NODE_CONFIG: 30 * 60 * 1000,

  /** Count queries are expensive but need reasonable freshness - 2 minutes */
  COUNTS: 2 * 60 * 1000,
} as const;

/**
 * Default cache module configuration
 * Uses in-memory store with 500MB max size
 */
export const cacheConfig: CacheModuleOptions = {
  isGlobal: true,
  ttl: 5 * 60 * 1000, // Default 5 minutes
  max: 1000, // Maximum number of items in cache
};

/**
 * Cache key generation utilities
 */
export class CacheKeys {
  // Channel keys
  static channelList(query: any): string {
    return `channels:list:${JSON.stringify(query)}`;
  }

  static channelDetail(channelId: string): string {
    return `channel:${channelId}`;
  }

  static channelByWallet(wallet: string, query: any): string {
    return `channels:wallet:${wallet}:${JSON.stringify(query)}`;
  }

  static channelByParticipant(participant: string, query: any): string {
    return `channels:participant:${participant}:${JSON.stringify(query)}`;
  }

  static channelByAddress(address: string, query: any): string {
    return `channels:address:${address}:${JSON.stringify(query)}`;
  }

  static channelCount(filters: any): string {
    return `channels:count:${JSON.stringify(filters)}`;
  }

  // Asset keys
  static assetList(query: any): string {
    return `assets:list:${JSON.stringify(query)}`;
  }

  static assetDetail(chainId: string, assetId: string): string {
    return `asset:${chainId}:${assetId}`;
  }

  static assetCount(filters: any): string {
    return `assets:count:${JSON.stringify(filters)}`;
  }

  // Network keys
  static networkList(query: any): string {
    return `networks:list:${JSON.stringify(query)}`;
  }

  static networkDetail(chainId: string): string {
    return `network:${chainId}`;
  }

  static networkCount(filters: any): string {
    return `networks:count:${JSON.stringify(filters)}`;
  }

  // App Session keys
  static appSessionList(query: any): string {
    return `app-sessions:list:${JSON.stringify(query)}`;
  }

  static appSessionDetail(id: string): string {
    return `app-session:${id}`;
  }

  static appSessionCount(filters: any): string {
    return `app-sessions:count:${JSON.stringify(filters)}`;
  }

  // Node keys
  static nodeList(query: any): string {
    return `nodes:list:${JSON.stringify(query)}`;
  }

  static nodeDetail(address: string): string {
    return `node:${address}`;
  }

  static nodeCount(filters: any): string {
    return `nodes:count:${JSON.stringify(filters)}`;
  }

  static nodeCountActive(): string {
    return 'nodes:count:active';
  }

  // Node Config keys
  static nodeConfig(): string {
    return 'node-config';
  }

  // Wildcard patterns for invalidation
  static allChannels(): string {
    return 'channels:*';
  }

  static allAssets(): string {
    return 'assets:*';
  }

  static allNetworks(): string {
    return 'networks:*';
  }

  static allAppSessions(): string {
    return 'app-sessions:*';
  }

  static allNodes(): string {
    return 'nodes:*';
  }
}

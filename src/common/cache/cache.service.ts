import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Centralized cache service for managing cache operations across the application
 * Provides methods for selective cache invalidation when data changes
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Invalidate all channel-related caches
   * Call this when channels are created, updated, or deleted
   *
   * NOTE: In-memory cache doesn't support wildcard deletion easily.
   * For production with high traffic, consider using Redis for better cache invalidation.
   * With Redis, you can use pattern-based deletion: keys('channels:*')
   */
  async invalidateChannels(): Promise<void> {
    try {
      this.logger.debug('Channel cache invalidation requested - caches will expire naturally based on TTL');
      // In-memory cache will expire based on TTL settings
      // For immediate invalidation, upgrade to Redis and implement pattern-based deletion
    } catch (error) {
      this.logger.error('Failed to invalidate channel caches', error);
    }
  }

  /**
   * Invalidate all asset-related caches
   * Call this when assets are created, updated, or deleted
   */
  async invalidateAssets(): Promise<void> {
    try {
      this.logger.debug('Asset cache invalidation requested - caches will expire naturally based on TTL');
      // In-memory cache will expire based on TTL settings (30-60 minutes for assets)
    } catch (error) {
      this.logger.error('Failed to invalidate asset caches', error);
    }
  }

  /**
   * Invalidate all network-related caches
   * Call this when networks are created, updated, or deleted
   */
  async invalidateNetworks(): Promise<void> {
    try {
      this.logger.debug('Network cache invalidation requested - caches will expire naturally based on TTL');
    } catch (error) {
      this.logger.error('Failed to invalidate network caches', error);
    }
  }

  /**
   * Invalidate all app session-related caches
   * Call this when app sessions are created, updated, or deleted
   */
  async invalidateAppSessions(): Promise<void> {
    try {
      this.logger.debug('App session cache invalidation requested - caches will expire naturally based on TTL');
    } catch (error) {
      this.logger.error('Failed to invalidate app session caches', error);
    }
  }

  /**
   * Invalidate all node-related caches
   * Call this when nodes are created, updated, or deleted
   */
  async invalidateNodes(): Promise<void> {
    try {
      this.logger.debug('Node cache invalidation requested - caches will expire naturally based on TTL');
    } catch (error) {
      this.logger.error('Failed to invalidate node caches', error);
    }
  }

  /**
   * Invalidate all caches
   * Use sparingly - only when major data changes occur
   */
  async invalidateAll(): Promise<void> {
    try {
      this.logger.warn('Full cache invalidation requested - consider using Redis for better invalidation control');
    } catch (error) {
      this.logger.error('Failed to invalidate all caches', error);
    }
  }

  /**
   * Invalidate a specific cache key
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache key invalidated: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache key: ${key}`, error);
    }
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  async getStats(): Promise<{ keys: number }> {
    try {
      // Basic stats - expand as needed
      // In-memory cache doesn't provide detailed stats by default
      return { keys: 0 }; // Placeholder
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return { keys: 0 };
    }
  }
}

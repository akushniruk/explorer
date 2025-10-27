import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

@Injectable()
export class NodeConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getConfig() {
    const cacheKey = CacheKeys.nodeConfig();

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const config = await this.prisma.nodeConfig.findFirst();

    if (!config) {
      throw new NotFoundException('NodeConfig not found');
    }

    // Store in cache (node config is very static)
    await this.cacheManager.set(cacheKey, config, CACHE_TTL.NODE_CONFIG);

    return config;
  }
}

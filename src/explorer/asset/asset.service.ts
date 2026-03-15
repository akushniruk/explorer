import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { GetAssetQueryDto } from './dto/get-asset.dto';
import { ListAssetsQueryDto } from './dto/list-assets.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getOne(q: GetAssetQueryDto): Promise<any> {
    const cacheKey = CacheKeys.assetDetail(q.chainId, q.token);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const chain = BigInt(q.chainId);
    const item = await this.prisma.asset.findFirst({
      where: { token: q.token, chain_id: chain },
    });

    if (!item) throw new NotFoundException(`Asset ${q.token}@${q.chainId} not found`);

    const result = {
      ...item,
      chain_id: item.chain_id.toString(),
      decimals: item.decimals.toString(),
    };

    // Store in cache (assets are very static)
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.ASSET_DETAIL);

    return result;
  }

  async list(q: ListAssetsQueryDto): Promise<any> {
    const cacheKey = CacheKeys.assetList(q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.AssetWhereInput = {
      ...(q.token ? { token: q.token } : {}),
      ...(q.chainId ? { chain_id: BigInt(q.chainId) } : {}),
      ...(q.q ? { symbol: { contains: q.q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.AssetOrderByWithRelationInput = {
      [q.sortBy ?? 'symbol']: q.order ?? 'asc',
    } as any;

    const skip = (q.page - 1) * q.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({ where, orderBy, skip, take: q.limit }),
      this.prisma.asset.count({ where }),
    ]);

    const totalPages = Math.ceil(total / q.limit);

    const serialized = items.map((a) => ({
      ...a,
      chain_id: a.chain_id.toString(),
      decimals: a.decimals.toString(),
    }));

    const result = {
      items: serialized,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };

    // Store in cache (assets change infrequently)
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.ASSETS);

    return result;
  }

  async count(filters: Pick<ListAssetsQueryDto, 'token' | 'chainId' | 'q'>): Promise<any> {
    const cacheKey = CacheKeys.assetCount(filters);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.AssetWhereInput = {
      ...(filters.token ? { token: filters.token } : {}),
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
      ...(filters.q ? { symbol: { contains: filters.q, mode: 'insensitive' } } : {}),
    };
    const total = await this.prisma.asset.count({ where });

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }
}

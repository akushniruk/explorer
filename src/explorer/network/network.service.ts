import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetNetworkQueryDto } from './dto/get-network.dto';
import { ListNetworksQueryDto } from './dto/list-networks.dto';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

@Injectable()
export class NetworkService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getOne(q: GetNetworkQueryDto) {
    const cacheKey = CacheKeys.networkDetail(q.chainId);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const id = BigInt(q.chainId);
    const row = await this.prisma.network.findUnique({ where: { chain_id: id } });

    if (!row) throw new NotFoundException(`Network ${q.chainId} not found`);

    const result = {
      ...row,
      chain_id: row.chain_id.toString(),
      // dates remain Date objects (serializer/interceptor can format if needed)
    };

    // Store in cache (networks are very static)
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.NETWORK_DETAIL);

    return result;
  }

  async list(q: ListNetworksQueryDto) {
    const cacheKey = CacheKeys.networkList(q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.NetworkWhereInput = {
      ...(q.chainId ? { chain_id: BigInt(q.chainId) } : {}),
      ...(q.broker ? { broker_address: q.broker } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.NetworkOrderByWithRelationInput = {
      [q.sortBy ?? 'name']: q.order ?? 'asc',
    } as any;

    const skip = (q.page - 1) * q.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.network.findMany({ where, orderBy, skip, take: q.limit }),
      this.prisma.network.count({ where }),
    ]);

    const totalPages = Math.ceil(total / q.limit);

    const serialized = items.map((n) => ({
      ...n,
      chain_id: n.chain_id.toString(),
    }));

    const result = {
      items: serialized,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };

    // Store in cache (networks rarely change)
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.NETWORKS);

    return result;
  }

  async count(filters: Pick<ListNetworksQueryDto, 'chainId' | 'q' | 'broker'>) {
    const cacheKey = CacheKeys.networkCount(filters);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.NetworkWhereInput = {
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
      ...(filters.broker ? { broker_address: filters.broker } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    };
    const total = await this.prisma.network.count({ where });

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }
}

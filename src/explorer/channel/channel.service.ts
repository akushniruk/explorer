import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelQueryDto } from './dto/get-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.dto';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

@Injectable()
export class ChannelService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getOne(q: GetChannelQueryDto): Promise<any> {
    const cacheKey = CacheKeys.channelDetail(q.channelId);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const item = await this.prisma.channel.findUnique({
      where: { channel_id: q.channelId },
      include: {
        asset: {
          select: {
            symbol: true,
            decimals: true,
          },
        },
      },
    });

    if (!item) throw new NotFoundException(`Channel ${q.channelId} not found`);

    // Transform BigInts to strings for JSON serialization
    const result = {
      ...item,
      chain_id: item.chain_id.toString(),
      amount: item.amount.toString(),
      challenge: item.challenge.toString(),
      nonce: item.nonce.toString(),
      version: item.version.toString(),
      asset: item.asset
        ? {
            symbol: item.asset.symbol,
            decimals: item.asset.decimals.toString(),
          }
        : null,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.CHANNEL_DETAIL);

    return result;
  }

  async list(q: ListChannelsQueryDto): Promise<any> {
    const cacheKey = CacheKeys.channelList(q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.ChannelWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.token ? { token: q.token } : {}),
      ...(q.chainId ? { chain_id: BigInt(q.chainId) } : {}),
      ...(q.wallet ? { wallet: { startsWith: q.wallet, mode: 'insensitive' } } : {}),
      ...(q.participant ? { participant: { startsWith: q.participant, mode: 'insensitive' } } : {}),
      ...(q.q
        ? {
            OR: [
              { channel_id: { startsWith: q.q } },
              { wallet: { startsWith: q.q, mode: 'insensitive' } },
              { participant: { startsWith: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ChannelOrderByWithRelationInput = {
      [q.sortBy ?? 'updated_at']: q.order ?? 'desc',
    };

    const offset = (q.page - 1) * q.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.channel.findMany({
        where,
        orderBy,
        skip: offset,
        take: q.limit,
        include: {
          asset: {
            select: {
              symbol: true,
              decimals: true,
            },
          },
        },
      }),
      this.prisma.channel.count({ where }),
    ]);

    const totalPages = Math.ceil(total / q.limit);

    // Transform BigInts to strings for JSON serialization
    const serializedItems = items.map((item) => ({
      ...item,
      chain_id: item.chain_id.toString(),
      amount: item.amount.toString(),
      challenge: item.challenge.toString(),
      nonce: item.nonce.toString(),
      version: item.version.toString(),
      asset: item.asset
        ? {
            symbol: item.asset.symbol,
            decimals: item.asset.decimals.toString(),
          }
        : null,
    }));

    const result = {
      items: serializedItems,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.CHANNELS);

    return result;
  }

  async count(filters: Pick<ListChannelsQueryDto, 'status' | 'token' | 'chainId'>): Promise<any> {
    const cacheKey = CacheKeys.channelCount(filters);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.ChannelWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.token ? { token: filters.token } : {}),
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
    };
    const total = await this.prisma.channel.count({ where });

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }

  async getByWallet(wallet: string, query: ListChannelsQueryDto): Promise<any> {
    const cacheKey = CacheKeys.channelByWallet(wallet, query);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.ChannelWhereInput = {
      wallet,
      ...(query.status ? { status: query.status } : {}),
      ...(query.token ? { token: query.token } : {}),
      ...(query.chainId ? { chain_id: BigInt(query.chainId) } : {}),
    };

    const orderBy: Prisma.ChannelOrderByWithRelationInput = {
      [query.sortBy ?? 'updated_at']: query.order ?? 'desc',
    };

    const offset = (query.page - 1) * query.limit;
    const [items, total, participantData] = await this.prisma.$transaction([
      this.prisma.channel.findMany({
        where,
        orderBy,
        skip: offset,
        take: query.limit,
        include: {
          asset: {
            select: {
              symbol: true,
              decimals: true,
            },
          },
        },
      }),
      this.prisma.channel.count({ where }),
      this.prisma.channel.findMany({
        where: { wallet },
        select: { participant: true },
        distinct: ['participant'],
        take: 500, // Limit distinct participants (reasonable for ~350 total channels)
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    // Transform BigInts to strings for JSON serialization
    const serializedItems = items.map((item) => ({
      ...item,
      chain_id: item.chain_id.toString(),
      amount: item.amount.toString(),
      challenge: item.challenge.toString(),
      nonce: item.nonce.toString(),
      version: item.version.toString(),
      asset: item.asset
        ? {
            symbol: item.asset.symbol,
            decimals: item.asset.decimals.toString(),
          }
        : null,
    }));

    const result = {
      items: serializedItems,
      participants: participantData.map((p) => p.participant),
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasMore: query.page < totalPages,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.CHANNEL_BY_ADDRESS);

    return result;
  }

  async getByParticipant(participant: string, query: ListChannelsQueryDto): Promise<any> {
    const cacheKey = CacheKeys.channelByParticipant(participant, query);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.ChannelWhereInput = {
      participant,
      ...(query.status ? { status: query.status } : {}),
      ...(query.token ? { token: query.token } : {}),
      ...(query.chainId ? { chain_id: BigInt(query.chainId) } : {}),
    };

    const orderBy: Prisma.ChannelOrderByWithRelationInput = {
      [query.sortBy ?? 'updated_at']: query.order ?? 'desc',
    };

    const offset = (query.page - 1) * query.limit;
    const [items, total, walletData] = await this.prisma.$transaction([
      this.prisma.channel.findMany({
        where,
        orderBy,
        skip: offset,
        take: query.limit,
        include: {
          asset: {
            select: {
              symbol: true,
              decimals: true,
            },
          },
        },
      }),
      this.prisma.channel.count({ where }),
      this.prisma.channel.findFirst({
        where: { participant },
        select: { wallet: true },
      }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    // Transform BigInts to strings for JSON serialization
    const serializedItems = items.map((item) => ({
      ...item,
      chain_id: item.chain_id.toString(),
      amount: item.amount.toString(),
      challenge: item.challenge.toString(),
      nonce: item.nonce.toString(),
      version: item.version.toString(),
      asset: item.asset
        ? {
            symbol: item.asset.symbol,
            decimals: item.asset.decimals.toString(),
          }
        : null,
    }));

    const result = {
      items: serializedItems,
      wallet: walletData?.wallet,
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasMore: query.page < totalPages,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.CHANNEL_BY_ADDRESS);

    return result;
  }

  async getByAddress(address: string, query: ListChannelsQueryDto): Promise<any> {
    const cacheKey = CacheKeys.channelByAddress(address, query);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    console.log(`[getByAddress] Called with address: ${address}`);

    // Optimized: Check both wallet and participant counts in a single transaction
    const [walletCount, participantCount] = await this.prisma.$transaction([
      this.prisma.channel.count({ where: { wallet: address } }),
      this.prisma.channel.count({ where: { participant: address } }),
    ]);

    console.log(
      `[getByAddress] Wallet count: ${walletCount}, Participant count: ${participantCount}`,
    );

    let result;

    // If found as wallet (prioritize wallet over participant)
    if (walletCount > 0) {
      const asWallet = await this.getByWallet(address, query);
      result = { ...asWallet, lookupType: 'wallet' as const };

      console.log(
        `[getByAddress] Returning wallet result with ${result.participants.length} participants`,
      );
    } else {
      // Otherwise return as participant (may have 0 items if address doesn't exist)
      const asParticipant = await this.getByParticipant(address, query);
      result = { ...asParticipant, lookupType: 'participant' as const };

      console.log(`[getByAddress] Returning participant result`);
    }

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.CHANNEL_BY_ADDRESS);

    return result;
  }
}

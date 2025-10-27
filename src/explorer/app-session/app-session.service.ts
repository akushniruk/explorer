import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, AppSession } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetAppSessionQueryDto } from './dto/get-app-session.dto';
import { ListAppSessionsQueryDto } from './dto/list-app-sessions.dto';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

export interface SerializedAppSession {
  id: number;
  protocol: string;
  session_id: string;
  channel_id: string;
  nonce: string;
  participants: string[];
  weight: number[];
  quorum: string;
  version: string;
  status: string;
  challenge: string | null;
  session_data: string | null;
  created_at: Date;
  updated_at: Date;
}

const serialize = (row: AppSession): SerializedAppSession => ({
  ...row,
  nonce: row.nonce?.toString(),
  version: row.version?.toString(),
  quorum: row.quorum?.toString(),
  challenge: row.challenge != null ? row.challenge.toString() : null,
});

@Injectable()
export class AppSessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getOne(q: GetAppSessionQueryDto) {
    const cacheKey = CacheKeys.appSessionDetail(q.sessionId);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const row = await this.prisma.appSession.findUnique({
      where: { session_id: q.sessionId },
    });

    if (!row) throw new NotFoundException(`App session ${q.sessionId} not found`);

    const result = serialize(row);

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.APP_SESSION_DETAIL);

    return result;
  }

  async list(q: ListAppSessionsQueryDto) {
    const cacheKey = CacheKeys.appSessionList(q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.AppSessionWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.channelId ? { channel_id: q.channelId } : {}),
      ...(q.participant ? { participants: { has: q.participant } } : {}),
      ...(q.q
        ? {
            OR: [
              { session_id: { startsWith: q.q } },
              { channel_id: { startsWith: q.q } },
              // NOTE: array prefix search isn't supported; has is exact match
            ],
          }
        : {}),
    };

    const orderBy: Prisma.AppSessionOrderByWithRelationInput = {
      [q.sortBy ?? 'updated_at']: q.order ?? 'desc',
    };

    const skip = (q.page - 1) * q.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appSession.findMany({ where, orderBy, skip, take: q.limit }),
      this.prisma.appSession.count({ where }),
    ]);

    const totalPages = Math.ceil(total / q.limit);

    const result = {
      items: items.map(serialize),
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.APP_SESSIONS);

    return result;
  }

  async count(
    filters: Pick<ListAppSessionsQueryDto, 'status' | 'channelId' | 'participant' | 'q'>,
  ) {
    const cacheKey = CacheKeys.appSessionCount(filters);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const where: Prisma.AppSessionWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channelId ? { channel_id: filters.channelId } : {}),
      ...(filters.participant ? { participants: { has: filters.participant } } : {}),
      ...(filters.q
        ? {
            OR: [
              { session_id: { startsWith: filters.q } },
              { channel_id: { startsWith: filters.q } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.appSession.count({ where });

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AppSession } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetAppSessionQueryDto } from './dto/get-app-session.dto';
import { ListAppSessionsQueryDto } from './dto/list-app-sessions.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async getOne(q: GetAppSessionQueryDto) {
    const row = await this.prisma.appSession.findUnique({
      where: { session_id: q.sessionId },
    });

    if (!row) throw new NotFoundException(`App session ${q.sessionId} not found`);

    return serialize(row);
  }

  async list(q: ListAppSessionsQueryDto) {
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

    return {
      items: items.map(serialize),
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };
  }

  async count(
    filters: Pick<ListAppSessionsQueryDto, 'status' | 'channelId' | 'participant' | 'q'>,
  ) {
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

    return { total };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelQueryDto } from './dto/get-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.dto';

@Injectable()
export class ChannelService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(q: GetChannelQueryDto) {
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
    return {
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
  }

  async list(q: ListChannelsQueryDto) {
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

    return {
      items: serializedItems,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };
  }

  async count(filters: Pick<ListChannelsQueryDto, 'status' | 'token' | 'chainId'>) {
    const where: Prisma.ChannelWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.token ? { token: filters.token } : {}),
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
    };
    const total = await this.prisma.channel.count({ where });

    return { total };
  }
}

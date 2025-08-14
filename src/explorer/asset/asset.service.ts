import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetAssetQueryDto } from './dto/get-asset.dto';
import { ListAssetsQueryDto } from './dto/list-assets.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(q: GetAssetQueryDto) {
    const chain = BigInt(q.chainId);
    const item = await this.prisma.asset.findFirst({
      where: { token: q.token, chain_id: chain },
    });

    if (!item) throw new NotFoundException(`Asset ${q.token}@${q.chainId} not found`);

    return {
      ...item,
      chain_id: item.chain_id.toString(),
      decimals: item.decimals.toString(),
    };
  }

  async list(q: ListAssetsQueryDto) {
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

    return {
      items: serialized,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };
  }

  async count(filters: Pick<ListAssetsQueryDto, 'token' | 'chainId' | 'q'>) {
    const where: Prisma.AssetWhereInput = {
      ...(filters.token ? { token: filters.token } : {}),
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
      ...(filters.q ? { symbol: { contains: filters.q, mode: 'insensitive' } } : {}),
    };
    const total = await this.prisma.asset.count({ where });

    return { total };
  }
}

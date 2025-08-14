import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetNetworkQueryDto } from './dto/get-network.dto';
import { ListNetworksQueryDto } from './dto/list-networks.dto';

@Injectable()
export class NetworkService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(q: GetNetworkQueryDto) {
    const id = BigInt(q.chainId);
    const row = await this.prisma.network.findUnique({ where: { chain_id: id } });

    if (!row) throw new NotFoundException(`Network ${q.chainId} not found`);

    return {
      ...row,
      chain_id: row.chain_id.toString(),
      // dates remain Date objects (serializer/interceptor can format if needed)
    };
  }

  async list(q: ListNetworksQueryDto) {
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

    return {
      items: serialized,
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };
  }

  async count(filters: Pick<ListNetworksQueryDto, 'chainId' | 'q' | 'broker'>) {
    const where: Prisma.NetworkWhereInput = {
      ...(filters.chainId ? { chain_id: BigInt(filters.chainId) } : {}),
      ...(filters.broker ? { broker_address: filters.broker } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    };
    const total = await this.prisma.network.count({ where });

    return { total };
  }
}

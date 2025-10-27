import { Injectable } from '@nestjs/common';
import { Prisma, Node as DbNode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListNodesQueryDto } from './dto/list-nodes.dto';

type NodeView = {
  slug: string;
  name: string;
  ws_url: string;
  address: string | null;
  website_host: string | null;
  icon_key: string | null;
  description: string | null;
  country_code: string;
  region: string;
  latitude: number;
  longitude: number;
  status: string;
  available: boolean;
  latency_ms: number | null;
  last_seen_at: Date | null;
  updated_at: Date;
};

function serialize(node: Omit<DbNode, 'id' | 'featured' | 'created_at'>): NodeView {
  return {
    slug: node.slug,
    name: node.name,
    ws_url: node.ws_url,
    address: node.address ?? null,
    website_host: node.website_host ?? null,
    icon_key: node.icon_key ?? null,
    description: node.description ?? null,
    country_code: node.country_code,
    region: node.region,
    latitude: Number(node.latitude),
    longitude: Number(node.longitude),
    status: node.status,
    available: node.available,
    latency_ms: node.latency_ms ?? null,
    last_seen_at: node.last_seen_at ?? null,
    updated_at: node.updated_at,
  };
}

function parseBbox(bbox?: string) {
  if (!bbox) return null;

  const [minLat, minLng, maxLat, maxLng] = bbox.split(',').map((v) => Number(v));

  if ([minLat, minLng, maxLat, maxLng].some((n) => !Number.isFinite(n))) return null;

  return { minLat, minLng, maxLat, maxLng };
}

@Injectable()
export class NodeService {
  constructor(private readonly prisma: PrismaService) {}

  async single(q: Pick<ListNodesQueryDto, 'q'>) {
    if (!q.q) {
      throw new Error('Query parameter "q" is required');
    }

    const node = await this.prisma.node.findFirst({
      where: {
        OR: [{ slug: q.q }, { name: { contains: q.q, mode: 'insensitive' } }],
      },
      select: {
        slug: true,
        name: true,
        ws_url: true,
        address: true,
        website_host: true,
        icon_key: true,
        description: true,
        country_code: true,
        region: true,
        latitude: true,
        longitude: true,
        status: true,
        available: true,
        latency_ms: true,
        last_seen_at: true,
        updated_at: true,
      },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    return serialize(node);
  }

  async list(q: ListNodesQueryDto) {
    const where: Prisma.NodeWhereInput = {
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.country ? { country_code: q.country.toUpperCase() } : {}),
      ...(q.region ? { region: q.region } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const bbox = parseBbox(q.bbox);

    if (bbox) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          latitude: { gte: new Prisma.Decimal(bbox.minLat), lte: new Prisma.Decimal(bbox.maxLat) },
        },
        {
          longitude: { gte: new Prisma.Decimal(bbox.minLng), lte: new Prisma.Decimal(bbox.maxLng) },
        },
      ];
    }

    const orderBy: Prisma.NodeOrderByWithRelationInput = {
      [q.sortBy ?? 'name']: q.order ?? 'asc',
    } as any;

    const skip = (q.page - 1) * q.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.node.findMany({
        where,
        orderBy,
        skip,
        take: q.limit,
        select: {
          slug: true,
          name: true,
          ws_url: true,
          address: true,
          website_host: true,
          icon_key: true,
          description: true,
          country_code: true,
          region: true,
          latitude: true,
          longitude: true,
          status: true,
          available: true,
          latency_ms: true,
          last_seen_at: true,
          updated_at: true,
        },
      }),
      this.prisma.node.count({ where }),
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

  async count(filters: Pick<ListNodesQueryDto, 'q' | 'country' | 'region' | 'status' | 'bbox'>) {
    const where: Prisma.NodeWhereInput = {
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
      ...(filters.country ? { country_code: filters.country.toUpperCase() } : {}),
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const bbox = parseBbox(filters.bbox);

    if (bbox) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          latitude: { gte: new Prisma.Decimal(bbox.minLat), lte: new Prisma.Decimal(bbox.maxLat) },
        },
        {
          longitude: { gte: new Prisma.Decimal(bbox.minLng), lte: new Prisma.Decimal(bbox.maxLng) },
        },
      ];
    }

    const total = await this.prisma.node.count({ where });

    return { total };
  }

  async countActive() {
    const total = await this.prisma.node.count({
      where: {
        OR: [{ status: 'active' }, { available: true }],
      },
    });

    return { total };
  }

  async findByAddress(address: string) {
    if (!address) {
      throw new Error('Address parameter is required');
    }

    const node = await this.prisma.node.findFirst({
      where: {
        address: {
          equals: address,
          mode: 'insensitive',
        },
      },
      select: {
        slug: true,
        name: true,
        ws_url: true,
        address: true,
        website_host: true,
        icon_key: true,
        description: true,
        country_code: true,
        region: true,
        latitude: true,
        longitude: true,
        status: true,
        available: true,
        latency_ms: true,
        last_seen_at: true,
        updated_at: true,
      },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    return serialize(node);
  }
}

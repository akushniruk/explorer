import { Injectable } from '@nestjs/common';
import { Prisma, Node as DbNode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListNodesQueryDto } from './dto/list-nodes.dto';

type NodeView = {
  slug: string;
  name: string;
  ws_url: string;
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

function serialize(node: DbNode): NodeView {
  return {
    slug: node.slug,
    name: node.name,
    ws_url: node.ws_url,
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
        // select minimal fields (optional; or return full row)
        // select: { slug: true, name: true, ... },
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
}

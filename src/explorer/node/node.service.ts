import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, Node as DbNode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListNodesQueryDto } from './dto/list-nodes.dto';
import { CacheKeys, CACHE_TTL } from '../../config/cache.config';

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

type NodeSelectShape = Pick<
  DbNode,
  | 'slug'
  | 'name'
  | 'ws_url'
  | 'address'
  | 'website_host'
  | 'icon_key'
  | 'description'
  | 'country_code'
  | 'region'
  | 'latitude'
  | 'longitude'
  | 'status'
  | 'available'
  | 'latency_ms'
  | 'last_seen_at'
  | 'updated_at'
>;

function serialize(node: NodeSelectShape): NodeView {
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async single(q: Pick<ListNodesQueryDto, 'q'>): Promise<any> {
    if (!q.q) {
      throw new Error('Query parameter "q" is required');
    }

    const cacheKey = CacheKeys.nodeDetail(q.q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
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

    const result = serialize(node);

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.NODE_DETAIL);

    return result;
  }

  async list(q: ListNodesQueryDto): Promise<any> {
    const cacheKey = CacheKeys.nodeList(q);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
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

    const result = {
      items: items.map(serialize),
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasMore: q.page < totalPages,
    };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.NODES);

    return result;
  }

  async count(
    filters: Pick<ListNodesQueryDto, 'q' | 'country' | 'region' | 'status' | 'bbox'>,
  ): Promise<any> {
    const cacheKey = CacheKeys.nodeCount(filters);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
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

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }

  async countActive(): Promise<any> {
    const cacheKey = CacheKeys.nodeCountActive();

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const total = await this.prisma.node.count({
      where: {
        OR: [{ status: 'active' }, { available: true }],
      },
    });

    const result = { total };

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.COUNTS);

    return result;
  }

  async findByAddress(address: string): Promise<any> {
    if (!address) {
      throw new Error('Address parameter is required');
    }

    const cacheKey = CacheKeys.nodeDetail(address);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const nodes = await this.prisma.node.findMany({
      where: {
        address: {
          equals: address,
          mode: 'insensitive',
        },
      },
      orderBy: [{ is_primary: 'desc' }, { updated_at: 'desc' }],
      take: 2,
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

    if (nodes.length === 0) {
      throw new Error('Node not found');
    }

    if (nodes.length > 1) {
      throw new Error('Multiple nodes found for address; expected a unique node address');
    }

    const result = serialize(nodes[0]);

    // Store in cache
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.NODE_DETAIL);

    return result;
  }
}

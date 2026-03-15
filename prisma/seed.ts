import { Prisma, PrismaClient, NodeRegion } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

type NodeSeed = {
  slug: string;
  name: string;
  wsUrl: string;
  protocolFamily?: string;
  protocolVersion?: string;
  syncEnabled?: boolean;
  isPrimary?: boolean;
  nodeRuntimeVersion?: string;
  supportedSigValidatorsBase64?: string;
  lastConfigAt?: string;
  lastConfigRawPayload?: unknown;
  websiteHost?: string;
  iconKey?: string;
  description?: string;
  address?: string;
  featured?: boolean;
  status?: string;
  available?: boolean;
  country: string; // ISO-3166 alpha-2
  region: string; // must match Prisma enum values
  lat: number;
  lng: number;
};

type SeedFile = { nodes: NodeSeed[] };

const D = (n: number | string) => new Prisma.Decimal(n);

async function main() {
  const file = path.join(__dirname, 'seeds/nodes.json');
  const raw = fs.readFileSync(file, 'utf8');
  const { nodes }: SeedFile = JSON.parse(raw);

  if (!nodes?.length) throw new Error('nodes.seed.json has no entries under "nodes"');

  let upserts = 0;

  for (const n of nodes) {
    await prisma.node.upsert({
      where: { slug: n.slug },
      update: {
        name: n.name,
        ws_url: n.wsUrl,
        protocol_family: n.protocolFamily ?? 'clearnode',
        protocol_version: n.protocolVersion ?? 'v0',
        sync_enabled: n.syncEnabled ?? true,
        is_primary: n.isPrimary ?? false,
        node_runtime_version: n.nodeRuntimeVersion ?? null,
        supported_sig_validators_base64: n.supportedSigValidatorsBase64 ?? null,
        last_config_at: n.lastConfigAt ? new Date(n.lastConfigAt) : null,
        last_config_raw_payload:
          n.lastConfigRawPayload === undefined
            ? undefined
            : (n.lastConfigRawPayload as Prisma.InputJsonValue),
        website_host: n.websiteHost ?? null,
        icon_key: n.iconKey ?? null,
        description: n.description ?? null,
        address: n.address ?? null,
        featured: n.featured ?? false,
        status: n.status ?? 'unknown',
        available: n.available ?? false,
        country_code: n.country,
        region: n.region as NodeRegion,
        latitude: D(n.lat),
        longitude: D(n.lng),
      },
      create: {
        slug: n.slug,
        name: n.name,
        ws_url: n.wsUrl,
        protocol_family: n.protocolFamily ?? 'clearnode',
        protocol_version: n.protocolVersion ?? 'v0',
        sync_enabled: n.syncEnabled ?? true,
        is_primary: n.isPrimary ?? false,
        node_runtime_version: n.nodeRuntimeVersion ?? null,
        supported_sig_validators_base64: n.supportedSigValidatorsBase64 ?? null,
        last_config_at: n.lastConfigAt ? new Date(n.lastConfigAt) : null,
        last_config_raw_payload:
          n.lastConfigRawPayload === undefined
            ? undefined
            : (n.lastConfigRawPayload as Prisma.InputJsonValue),
        website_host: n.websiteHost ?? null,
        icon_key: n.iconKey ?? null,
        description: n.description ?? null,
        address: n.address ?? null,
        featured: n.featured ?? false,
        country_code: n.country,
        region: n.region as NodeRegion,
        latitude: D(n.lat),
        longitude: D(n.lng),
        status: n.status ?? 'unknown',
        available: n.available ?? false,
      },
    });
    upserts++;
  }

  const total = await prisma.node.count();

  console.log(`Seeded/updated nodes: ${upserts}; total rows now: ${total}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

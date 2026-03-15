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

  // Seed onchain chain configs (ChannelHub deployments)
  const chainConfigs = [
    {
      chain_id: 80002n,
      channel_hub_address: '0x55D6f0A0322606447fbc612Cf58014Faed65aF9D',
      start_block: 34883097n, // deployment block minus 10 for verification
    },
    {
      chain_id: 11155111n,
      channel_hub_address: '0xb7bE0E2007dDF320d680942cb9e008F986E74F83',
      start_block: 10402866n, // deployment block minus 10 for verification
    },
  ];

  let chainUpserts = 0;

  for (const cc of chainConfigs) {
    await prisma.onchainChainConfig.upsert({
      where: { chain_id: cc.chain_id },
      update: {
        channel_hub_address: cc.channel_hub_address,
        start_block: cc.start_block,
      },
      create: {
        chain_id: cc.chain_id,
        channel_hub_address: cc.channel_hub_address,
        start_block: cc.start_block,
        enabled: true,
      },
    });
    chainUpserts++;
  }

  const chainTotal = await prisma.onchainChainConfig.count();

  console.log(`Seeded/updated chain configs: ${chainUpserts}; total rows now: ${chainTotal}`);
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

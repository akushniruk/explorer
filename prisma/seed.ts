import { Prisma, PrismaClient, NodeRegion } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

type NodeSeed = {
  slug: string;
  name: string;
  wsUrl: string;
  websiteHost?: string;
  iconKey?: string;
  description?: string;
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
        website_host: n.websiteHost ?? null,
        icon_key: n.iconKey ?? null,
        description: n.description ?? null,
        country_code: n.country,
        region: n.region as NodeRegion,
        latitude: D(n.lat),
        longitude: D(n.lng),
        // status/available to health worker to manage
      },
      create: {
        slug: n.slug,
        name: n.name,
        ws_url: n.wsUrl,
        website_host: n.websiteHost ?? null,
        icon_key: n.iconKey ?? null,
        description: n.description ?? null,
        country_code: n.country,
        region: n.region as NodeRegion,
        latitude: D(n.lat),
        longitude: D(n.lng),
        status: 'unknown',
        available: false,
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

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetConfigResponse, GetConfigResponseParams, RPCMethod } from '@erc7824/nitrolite';
import { YellowApiService } from '../yellow-api.service';

type Address = `0x${string}`;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const asAddress = (v: string, field: string) => {
  if (!ADDRESS_RE.test(v)) throw new Error(`Invalid ${field}: ${v}`);

  return v as Address;
};
const toNum = (bi: bigint, field: string) => {
  const n = Number(bi);

  if (!Number.isFinite(n)) throw new Error(`Overflow ${field}: ${bi.toString()}`);

  return n;
};

@Injectable()
export class NodeConfigService {
  private readonly logger = new Logger(NodeConfigService.name);
  private cache?: { value: GetConfigResponseParams; expiresAt: number };
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly yellow: YellowApiService,
  ) {}

  /** Force a fresh fetch on startup to ensure we have latest config. */
  async warm(opts?: { forceFetch?: boolean; refreshIfStaleMs?: number }): Promise<void> {
    try {
      const force = !!opts?.forceFetch;
      const staleMs = opts?.refreshIfStaleMs ?? this.ttlMs;

      if (!force) {
        const node = await this.prisma.nodeConfig.findUnique({ where: { id: 'default' } });

        if (node) {
          const age = Date.now() - new Date(node.updated_at).getTime();

          if (age < staleMs) {
            this.logger.log('Config warm-up skipped (DB fresh)', { source: 'db', ageMs: age });
            this.cache = {
              value: await this.readParamsFromDbOrThrow(),
              expiresAt: Date.now() + this.ttlMs,
            };

            return;
          }
        }
      }

      this.logger.log('Config warm-up fetching from upstream', { forceFetch: force });
      const envelope = await this.yellow.getConfig();

      await this.persist(envelope.params);
      this.cache = { value: envelope.params, expiresAt: Date.now() + this.ttlMs };
      this.logger.log('Config warm-up completed (upstream)', {
        networks: envelope.params.networks.length,
        brokerAddress: envelope.params.brokerAddress,
      });
    } catch (e) {
      this.logger.warn(`Config warm-up failed: ${(e as Error).message}`);
    }
  }

  /** Envelope from DB (fallback to fetch+persist) */
  async getConfigEnvelope(): Promise<GetConfigResponse> {
    const params = await this.getParamsFromDbOrFetch();

    return { requestId: 0, method: RPCMethod.GetConfig, params };
  }

  /** Params with small in-memory cache */
  async getPublicConfigParams(force = false): Promise<GetConfigResponseParams> {
    const now = Date.now();

    if (!force && this.cache && this.cache.expiresAt > now) return this.cache.value;

    const params = await this.getParamsFromDbOrFetch();

    this.cache = { value: params, expiresAt: now + this.ttlMs };

    return params;
  }

  // ---------- internals ----------

  private async getParamsFromDbOrFetch(): Promise<GetConfigResponseParams> {
    const fromDb = await this.readParamsFromDb();

    if (fromDb) return fromDb;

    const envelope = await this.yellow.getConfig();

    await this.persist(envelope.params);

    return envelope.params;
  }

  private async readParamsFromDbOrThrow(): Promise<GetConfigResponseParams> {
    const p = await this.readParamsFromDb();

    if (!p) throw new Error('Config not found in DB');

    return p;
  }

  private async readParamsFromDb(): Promise<GetConfigResponseParams | null> {
    const node = await this.prisma.nodeConfig.findUnique({ where: { id: 'default' } });

    if (!node) return null;

    // if networks table exists and is populated, load it; else, serve empty list safely
    let networks: GetConfigResponseParams['networks'] = [];

    try {
      const nets = await this.prisma.network.findMany({ orderBy: { chain_id: 'asc' } });

      networks = nets.map((n: any) => ({
        name: n.name,
        chainId: toNum(n.chain_id, 'chainId'),
        custodyAddress: asAddress(n.custody_address, 'custodyAddress'),
        adjudicatorAddress: asAddress(n.adjudicator_address, 'adjudicatorAddress'),
      }));
    } catch {
      // networks table not present yet — OK for early MVP
      networks = [];
    }

    return {
      brokerAddress: asAddress(node.broker_address, 'brokerAddress'),
      networks,
    };
  }

  private async persist(params: GetConfigResponseParams): Promise<void> {
    this.logger.log('Persisting node config', {
      brokerAddress: params.brokerAddress,
      networks: params.networks.length,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.nodeConfig.upsert({
        where: { id: 'default' },
        update: { broker_address: params.brokerAddress },
        create: { id: 'default', broker_address: params.brokerAddress },
      });

      // optional: persist networks if table exists
      try {
        const now = new Date();

        for (const n of params.networks) {
          await tx.network.upsert({
            where: { chain_id: BigInt(n.chainId) },
            update: {
              name: n.name,
              custody_address: n.custodyAddress,
              adjudicator_address: n.adjudicatorAddress,
              broker_address: params.brokerAddress,
              last_seen_at: now,
            },
            create: {
              chain_id: BigInt(n.chainId),
              name: n.name,
              custody_address: n.custodyAddress,
              adjudicator_address: n.adjudicatorAddress,
              broker_address: params.brokerAddress,
              last_seen_at: now,
            },
          });
        }
      } catch {
        // networks table not present — ignore for now
      }
    });
  }
}

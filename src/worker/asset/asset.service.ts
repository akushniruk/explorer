// src/worker/asset/asset.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import { GetAssetsResponseParams } from '@erc7824/nitrolite';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i;
const asAddress = (v: string, field: string) => {
  if (!ADDRESS_RE.test(v)) throw new Error(`Invalid ${field}: ${v}`);

  return v as `0x${string}`;
};
const toBigIntSafe = (n: number, field: string) => {
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid ${field}: ${n}`);
  }

  return BigInt(n);
};
const sanitizeSymbol = (s: string) => s?.trim().slice(0, 32) || '';

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yellow: YellowApiService,
  ) {}

  /**
   * Fetch assets from upstream and upsert into DB.
   * @param opts.chainId Optional filter
   */
  async syncAssets(opts?: { chainId?: number }): Promise<{ count: number }> {
    const start = Date.now();

    const res = await this.yellow.getAssets(opts?.chainId);
    const params = res.params;

    if (!params || !params.assets || params.assets.length === 0) {
      this.logger.log('No assets returned from upstream', {
        chainId: opts?.chainId ?? 'all',
      });

      return { count: 0 };
    }

    await this.processAssets(params);

    const duration = Date.now() - start;

    this.logger.log('Assets synchronized', {
      count: params.assets.length,
      chainId: opts?.chainId ?? 'all',
      durationMs: duration,
    });

    return { count: params.assets.length };
  }

  /**
   * Idempotent upserts in chunks. Validates addresses/decimals.
   */
  async processAssets(assetsResponse: GetAssetsResponseParams): Promise<void> {
    // map & validate
    const rows = assetsResponse.assets.map((a) => ({
      token: asAddress(a.token, 'token'),
      chain_id: toBigIntSafe(a.chainId, 'chainId'),
      symbol: sanitizeSymbol(a.symbol),
      decimals: toBigIntSafe(a.decimals, 'decimals'),
    }));

    const CHUNK = 50;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);

      await this.prisma.$transaction(
        slice.map((r) =>
          this.prisma.asset.upsert({
            where: { token_chain_id: { token: r.token, chain_id: r.chain_id } }, // @@id([token, chain_id])
            create: r,
            update: { symbol: r.symbol, decimals: r.decimals },
          }),
        ),
      );
    }
  }
}

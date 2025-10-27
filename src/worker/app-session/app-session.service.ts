import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import { GetAppSessionsResponse, RPCAppSession } from '@erc7824/nitrolite';
import workerCfg from '../worker.config';
import { ConfigType } from '@nestjs/config';

type RawSnake = {
  app_session_id: unknown;
  status?: unknown;
  participants?: unknown[];
  protocol?: unknown;
  challenge?: unknown;
  weights?: unknown[];
  quorum?: unknown;
  version?: unknown;
  nonce?: unknown;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  session_data?: unknown;
};

type AnySession = RPCAppSession | RawSnake | Record<string, unknown>;

@Injectable()
export class AppSessionService {
  private readonly logger = new Logger(AppSessionService.name);
  private readonly CHUNK = 500; // Increased for bulk SQL

  constructor(
    private readonly prisma: PrismaService,
    private readonly yellow: YellowApiService,
    @Inject(workerCfg.KEY) private readonly cfg: ConfigType<typeof workerCfg>,
  ) {}

  /**
   * Pull pages under a time budget; uses participant '' (all sessions).
   * Tolerant to SDK parse failures (we normalize shape ourselves).
   */
  async syncAllWithBudget(): Promise<{ count: number }> {
    const limit = Number(this.cfg?.sync?.appSessionsPageSize ?? 1000);
    const budgetMs = Number(this.cfg?.sync?.appSessionsBudgetMs ?? 60_000);
    const started = Date.now();

    let offset = 0;
    let total = 0;

    while (Date.now() - started < budgetMs) {
      let res: GetAppSessionsResponse;

      try {
        // Try with null/undefined participant first, then empty string fallback
        try {
          res = await this.yellow.getAppSessions({
            limit,
            offset,
            sort: 'desc',
          });
        } catch (firstError) {
          this.logger.debug('First app sessions call failed, trying with empty participant', {
            error: (firstError as Error).message,
          });
          res = await this.yellow.getAppSessions({
            participant: '', // empty => "all sessions"
            limit,
            offset,
            sort: 'desc',
          });
        }
      } catch (e) {
        this.logger.warn('Upstream error fetching app sessions; aborting this cycle', {
          error: (e as Error).message,
          offset,
          limit,
        });
        break;
      }

      // res.params should now have appSessions property in v0.3.0
      // Handle both old direct array format and new nested format for compatibility
      const rawParams = res.params ?? {};
      let page: unknown[];

      if (rawParams && typeof rawParams === 'object' && 'appSessions' in rawParams) {
        // New v0.3.0 format: { appSessions: [...] }
        page = Array.isArray((rawParams as any).appSessions) ? (rawParams as any).appSessions : [];
      } else {
        // Legacy format fallback
        const rawArray = rawParams as any;

        page =
          Array.isArray(rawArray) && rawArray.length === 1 && Array.isArray(rawArray[0])
            ? rawArray[0]
            : Array.isArray(rawArray)
              ? rawArray
              : [];
      }

      if (!Array.isArray(page) || page.length === 0) break;

      const normalized = (page as AnySession[])
        .map((s) => this.normalizeToCamel(s))
        .filter((v): v is RPCAppSession => !!v);

      if (normalized.length === 0) {
        this.logger.warn('All app sessions on page skipped due to normalization issues', {
          offset,
          limit,
        });
      } else {
        await this.process(normalized);
        total += normalized.length;
      }

      if (page.length < limit) break;

      offset += limit;
    }

    this.logger.log('App sessions sync complete', { total, spentMs: Date.now() - started });

    return { count: total };
  }

  /**
   * Normalize either SDK-shaped (camelCase) or raw snake_case objects to the SDK type.
   * No address validation; participants are persisted as strings as-is.
   */
  private normalizeToCamel(s: AnySession): RPCAppSession | null {
    // Case 1: already camelCase (strict parser path)
    if (s && typeof s === 'object' && 'appSessionId' in s) {
      const c = s as RPCAppSession;
      const id = String(c.appSessionId ?? '');

      if (!id) {
        this.logger.warn('Skipping app session: missing appSessionId (camelCase)');

        return null;
      }

      return {
        appSessionId: id as `0x${string}`,
        status: (c.status as any) ?? 'unknown',
        participants: Array.isArray(c.participants) ? (c.participants.map(String) as any) : [],
        protocol: String(c.protocol ?? ''),
        challenge: this.num(c.challenge),
        weights: Array.isArray(c.weights) ? c.weights.map((x) => Number(x) || 0) : [],
        quorum: this.num(c.quorum),
        version: this.num(c.version),
        nonce: this.num(c.nonce),
        createdAt: this.dateOrNull(c.createdAt),
        updatedAt: this.dateOrNull(c.updatedAt),
        sessionData: c.sessionData ?? undefined,
      } as RPCAppSession;
    }

    // Case 2: snake_case (loose parser path)
    const r = s as RawSnake;
    const id = String(r.app_session_id ?? '');

    if (!id) {
      this.logger.warn('Skipping app session: missing app_session_id (snake_case)');

      return null;
    }

    return {
      appSessionId: id as `0x${string}`,
      status: (r.status as any) ?? 'unknown',
      participants: Array.isArray(r.participants) ? (r.participants.map(String) as any) : [],
      protocol: String(r.protocol ?? ''),
      challenge: this.num(r.challenge),
      weights: Array.isArray(r.weights) ? r.weights.map((x) => Number(x) || 0) : [],
      quorum: this.num(r.quorum),
      version: this.num(r.version),
      nonce: this.num(r.nonce),
      createdAt: this.dateOrNull(r.created_at),
      updatedAt: this.dateOrNull(r.updated_at),
      sessionData: (r.session_data as any) ?? undefined,
    } as RPCAppSession;
  }

  private num(v: unknown): number {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);

    return Number.isFinite(n) ? n : 0;
  }

  private dateOrNull(v: unknown): Date | null {
    if (v instanceof Date) {
      return Number.isNaN(v.getTime()) ? null : v;
    }

    if (typeof v === 'string' && v.length > 0) {
      const d = new Date(v);

      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  private isValidDate(d: unknown): d is Date {
    return d instanceof Date && !Number.isNaN(d.getTime());
  }

  /**
   * Upsert normalized sessions in chunks. No address validation; raw participants persisted.
   * `created_at` is set only when valid; otherwise Prisma uses default(now()).
   */
  private async process(items: RPCAppSession[]): Promise<void> {
    const rows = items.map((s) => {
      const created = s.createdAt ?? null;
      const updated = s.updatedAt ?? null;

      return {
        session_id: s.appSessionId,
        protocol: s.protocol ?? '',
        participants: Array.isArray(s.participants) ? s.participants.map(String) : [],
        weight: Array.isArray(s.weights) ? s.weights.map((x) => Number(x) || 0) : [],
        quorum: BigInt(this.num(s.quorum)),
        version: BigInt(this.num(s.version)),
        nonce: BigInt(this.num(s.nonce)),
        status: String(s.status ?? 'unknown'),
        channel_id: '', // RPC doesn't link channel
        challenge: BigInt(this.num(s.challenge)),
        session_data: s.sessionData ?? null,
        created_at: created,
        updated_at: updated,
      };
    });

    // Check for duplicates within the batch
    const uniqueIds = new Set(rows.map((r) => r.session_id));
    const duplicatesInBatch = rows.length - uniqueIds.size;

    if (duplicatesInBatch > 0) {
      this.logger.warn('Found duplicate session IDs in the same batch', {
        totalRows: rows.length,
        uniqueIds: uniqueIds.size,
        duplicates: duplicatesInBatch,
      });
    }

    // Bulk upsert using raw SQL to reduce 4M queries to 8K queries (500x reduction)
    for (let i = 0; i < rows.length; i += this.CHUNK) {
      const slice = rows.slice(i, i + this.CHUNK);

      // NOTE: We no longer pre-check which sessions exist to avoid SELECT egress.
      // Postgres ON CONFLICT handles insert vs update efficiently with proper indexes.

      const values: string[] = [];

      slice.forEach((r) => {
        const createdAt = this.isValidDate(r.created_at)
          ? r.created_at.toISOString()
          : new Date().toISOString();
        const updatedAt = this.isValidDate(r.updated_at)
          ? r.updated_at.toISOString()
          : new Date().toISOString();

        // Escape single quotes and prepare array literals
        const participants = `{${r.participants.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`;
        const sessionData = r.session_data
          ? `'${String(r.session_data).replace(/'/g, "''")}'`
          : 'NULL';

        values.push(
          `('${r.protocol}', '${r.session_id}', '${r.channel_id}', ${r.nonce}, '${participants}'::text[], '{${r.weight.join(',')}}'::integer[], ${r.quorum}, ${r.version}, '${r.status}', ${r.challenge}, ${sessionData}, '${createdAt}', '${updatedAt}')`,
        );
      });

      const sql = `
        INSERT INTO "app_sessions" (
          "protocol", "session_id", "channel_id", "nonce", "participants",
          "weight", "quorum", "version", "status", "challenge",
          "session_data", "created_at", "updated_at"
        )
        VALUES ${values.join(', ')}
        ON CONFLICT ("session_id")
        DO UPDATE SET
          "protocol" = EXCLUDED."protocol",
          "participants" = EXCLUDED."participants",
          "weight" = EXCLUDED."weight",
          "quorum" = EXCLUDED."quorum",
          "version" = EXCLUDED."version",
          "nonce" = EXCLUDED."nonce",
          "status" = EXCLUDED."status",
          "challenge" = EXCLUDED."challenge",
          "session_data" = EXCLUDED."session_data",
          "updated_at" = EXCLUDED."updated_at"
      `;

      await this.prisma.$executeRawUnsafe(sql);

      this.logger.debug('Processed app sessions chunk', {
        chunkIndex: Math.floor(i / this.CHUNK) + 1,
        chunkSize: slice.length,
      });
    }

    this.logger.log('App sessions batch processed', {
      totalProcessed: rows.length,
      duplicatesInBatch,
    });
  }
}

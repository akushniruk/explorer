import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import { GetAppSessionsResponse, GetAppSessionsResponseParams } from '@erc7824/nitrolite';
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

type AnySession = GetAppSessionsResponseParams | RawSnake | Record<string, unknown>;

@Injectable()
export class AppSessionService {
  private readonly logger = new Logger(AppSessionService.name);
  private readonly CHUNK = 50;

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
    const limit = Number(this.cfg?.sync?.appSessionsPageSize ?? 100);
    const budgetMs = Number(this.cfg?.sync?.appSessionsBudgetMs ?? 10_000);
    const started = Date.now();

    let offset = 0;
    let total = 0;

    while (Date.now() - started < budgetMs) {
      let res: GetAppSessionsResponse;

      try {
        res = await this.yellow.getAppSessions({
          participant: '', // empty => “all sessions”
          pagination: { limit, offset, sort: 'desc' },
        });
      } catch (e) {
        this.logger.warn('Upstream error fetching app sessions; aborting this cycle', {
          error: (e as Error).message,
          offset,
          limit,
        });
        break;
      }

      // res.params may be either:
      //  - [ { ... }, ... ]  (strict SDK path)
      //  - [ [ { ... }, ... ] ]  (loose path; raw snake_case from server)
      const rawParams = res.params ?? [];
      const page: unknown[] =
        Array.isArray(rawParams) && rawParams.length === 1 && Array.isArray((rawParams as any)[0])
          ? (rawParams as any)[0]
          : (rawParams as any);

      if (!Array.isArray(page) || page.length === 0) break;

      const normalized = (page as AnySession[])
        .map((s) => this.normalizeToCamel(s))
        .filter((v): v is GetAppSessionsResponseParams => !!v);

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
  private normalizeToCamel(s: AnySession): GetAppSessionsResponseParams | null {
    // Case 1: already camelCase (strict parser path)
    if (s && typeof s === 'object' && 'appSessionId' in s) {
      const c = s as GetAppSessionsResponseParams;
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
      } as GetAppSessionsResponseParams;
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
    } as GetAppSessionsResponseParams;
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
  private async process(items: GetAppSessionsResponseParams[]): Promise<void> {
    const rows = items.map((s) => {
      const created = s.createdAt ?? null;

      return {
        session_id: s.appSessionId,
        protocol: s.protocol ?? '',
        participants: Array.isArray(s.participants) ? s.participants.map(String) : [],
        weight: Array.isArray(s.weights) ? s.weights.map((x) => Number(x) || 0) : [],
        quorum: BigInt(this.num(s.quorum)),
        version: BigInt(this.num(s.version)),
        nonce: BigInt(this.num(s.nonce)),
        status: String(s.status ?? 'unknown'),
        channel_id: '', // RPC doesn’t link channel
        challenge: BigInt(this.num(s.challenge)),
        session_data: s.sessionData ?? null,
        created_at: created, // conditionally applied below
      };
    });

    for (let i = 0; i < rows.length; i += this.CHUNK) {
      const slice = rows.slice(i, i + this.CHUNK);

      await this.prisma.$transaction(
        slice.map((r) => {
          const createBase: any = {
            session_id: r.session_id,
            protocol: r.protocol,
            participants: r.participants,
            weight: r.weight,
            quorum: r.quorum,
            version: r.version,
            nonce: r.nonce,
            status: r.status,
            channel_id: r.channel_id,
            challenge: r.challenge,
            session_data: r.session_data,
          };

          if (this.isValidDate(r.created_at)) {
            createBase.created_at = r.created_at;
          }

          return this.prisma.appSession.upsert({
            where: { session_id: r.session_id },
            create: createBase,
            update: {
              protocol: r.protocol,
              participants: r.participants,
              weight: r.weight,
              quorum: r.quorum,
              version: r.version,
              nonce: r.nonce,
              status: r.status,
              challenge: r.challenge,
              session_data: r.session_data,
            },
          });
        }),
      );
    }
  }
}

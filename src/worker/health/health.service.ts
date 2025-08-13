import { Injectable, Logger, Inject } from '@nestjs/common';
import { YellowApiService } from '../yellow-api.service';
import workerCfg from '../worker.config';
import { ConfigType } from '@nestjs/config';

export type HealthStatus = 'healthy' | 'down';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly yellow: YellowApiService,
    @Inject(workerCfg.KEY) private readonly cfg: ConfigType<typeof workerCfg>,
  ) {}

  /**
   * Pings the Yellow node. Returns status + latency.
   * Uses YellowApiService.ping(), which expects a 'pong' response.
   */
  async check(): Promise<{ status: HealthStatus; latencyMs: number }> {
    const start = Date.now();

    try {
      await this.yellow.ping();
      const latencyMs = Date.now() - start;

      // keep logs quiet when things are fine
      this.logger.debug('Health check OK', { latencyMs });

      return { status: 'healthy', latencyMs };
    } catch (e) {
      const latencyMs = Date.now() - start;

      this.logger.warn('Health check failed', {
        latencyMs,
        error: (e as Error)?.message ?? String(e),
      });

      return { status: 'down', latencyMs };
    }
  }

  /** Convenience helper for gating logic. */
  async isHealthy(): Promise<boolean> {
    const h = await this.check();

    return h.status === 'healthy';
  }
}

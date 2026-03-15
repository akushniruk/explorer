import { registerAs } from '@nestjs/config';

export default registerAs('workerOnchain', () => ({
  enabled: String(process.env.ONCHAIN_INDEXER_ENABLED ?? 'false').toLowerCase() === 'true',
  syncIntervalMs: Number(process.env.ONCHAIN_SYNC_INTERVAL_MS ?? 30_000),
  maxChainsPerTick: Number(process.env.ONCHAIN_MAX_CHAINS_PER_TICK ?? 10),
}));

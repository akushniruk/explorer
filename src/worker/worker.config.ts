import { registerAs } from '@nestjs/config';

export default registerAs('worker', () => ({
  wsUrl: process.env.YELLOW_API_URL!,
  wsRequestTimeoutMs: Number(process.env.YELLOW_WS_REQUEST_TIMEOUT_MS ?? 90_000),
  wsReconnectBaseMs: Number(process.env.YELLOW_WS_RECONNECT_BASE_MS ?? 1_000),
  wsReconnectMaxMs: Number(process.env.YELLOW_WS_RECONNECT_MAX_MS ?? 60_000),
  sync: {
    intervalMs: Number(process.env.SYNC_INTERVAL_MS ?? 90_000),
    fullSleepMs: Number(process.env.SYNC_FULL_SLEEP_MS ?? 3_000),
    channelsLimit: Number(process.env.SYNC_CHANNELS_LIMIT ?? 100),
    assetsRefreshMs: Number(process.env.SYNC_ASSETS_REFRESH_MS ?? 30 * 60 * 1000),
    appSessionsPageSize: Number(process.env.SYNC_APP_SESSIONS_PAGE_SIZE ?? 100),
    appSessionsBudgetMs: Number(process.env.SYNC_APP_SESSIONS_BUDGET_MS ?? 60_000),
    appSessionsRefreshMs: Number(process.env.SYNC_APP_SESSIONS_REFRESH_MS ?? 5 * 60 * 1000),
    txsPageSize: Number(process.env.SYNC_TXS_PAGE_SIZE ?? 200),
    txsBudgetMs: Number(process.env.SYNC_TXS_BUDGET_MS ?? 10_000),
  },
  tx: {
    pageSize: Number(process.env.SYNC_TXS_PAGE_SIZE ?? 200),
    budgetMs: Number(process.env.SYNC_TXS_BUDGET_MS ?? 10_000),
  },
  api: {
    rateLimitRpm: Number(process.env.RATE_LIMIT_RPM ?? 60),
    corsOrigins: process.env.CORS_ORIGINS ?? '*',
  },
}));

import * as Joi from 'joi';

const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;

type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export type EnvVars = {
  NODE_ENV: NodeEnv;

  DATABASE_URL: string;
  DIRECT_URL?: string;

  YELLOW_API_URL: string;
  YELLOW_WS_REQUEST_TIMEOUT_MS: number;
  YELLOW_WS_RECONNECT_BASE_MS: number;
  YELLOW_WS_RECONNECT_MAX_MS: number;
  SYNC_INTERVAL_MS: number;
  SYNC_CHANNELS_LIMIT: number;
  SYNC_CHANNELS_BUDGET_MS: number;
  SYNC_CHANNELS_SLEEP_MS: number;
  SYNC_CHANNELS_REFRESH_MS: number;
  SYNC_ASSETS_REFRESH_MS: number;
  SYNC_APP_SESSIONS_PAGE_SIZE: number;
  SYNC_APP_SESSIONS_BUDGET_MS: number;
  SYNC_APP_SESSIONS_REFRESH_MS: number;
  SYNC_TXS_PAGE_SIZE: number;
  SYNC_TXS_BUDGET_MS: number;
  OFFCHAIN_SYNC_ENABLED: string;
  ONCHAIN_INDEXER_ENABLED: string;
  INFURA_API_KEY?: string;
  ONCHAIN_SYNC_INTERVAL_MS: number;
  ONCHAIN_MAX_CHAINS_PER_TICK: number;

  RATE_LIMIT_RPM: number;
  CORS_ORIGINS: string;

  // ETag caching
  ENABLE_ETAG: string;
};

export const envValidationSchema: Joi.ObjectSchema<EnvVars> = Joi.object<EnvVars>({
  NODE_ENV: Joi.string()
    .valid(...NODE_ENV_VALUES)
    .default('development'),

  DATABASE_URL: Joi.string().uri().required(),
  DIRECT_URL: Joi.string().uri().optional(),

  YELLOW_API_URL: Joi.string()
    .uri({ scheme: ['ws', 'wss'] })
    .when('OFFCHAIN_SYNC_ENABLED', {
      is: 'true',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  YELLOW_WS_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(90_000),
  YELLOW_WS_RECONNECT_BASE_MS: Joi.number().integer().min(100).default(1_000),
  YELLOW_WS_RECONNECT_MAX_MS: Joi.number().integer().min(1_000).default(60_000),

  SYNC_INTERVAL_MS: Joi.number().integer().min(5_000).default(90_000),
  SYNC_CHANNELS_LIMIT: Joi.number().integer().min(10).max(1000).default(100),
  SYNC_CHANNELS_BUDGET_MS: Joi.number().integer().min(1000).default(60_000),
  SYNC_CHANNELS_SLEEP_MS: Joi.number().integer().min(0).default(1000),
  SYNC_CHANNELS_REFRESH_MS: Joi.number()
    .integer()
    .min(10_000)
    .default(5 * 60 * 1000),
  SYNC_ASSETS_REFRESH_MS: Joi.number()
    .integer()
    .min(10_000)
    .default(30 * 60 * 1000),
  SYNC_APP_SESSIONS_PAGE_SIZE: Joi.number().integer().min(10).max(500).default(100),
  SYNC_APP_SESSIONS_BUDGET_MS: Joi.number().integer().min(1000).default(60_000),
  SYNC_APP_SESSIONS_REFRESH_MS: Joi.number()
    .integer()
    .min(10_000)
    .default(5 * 60 * 1000),
  SYNC_TXS_PAGE_SIZE: Joi.number().integer().min(50).max(1000).default(200),
  SYNC_TXS_BUDGET_MS: Joi.number().integer().min(1000).default(10_000),
  OFFCHAIN_SYNC_ENABLED: Joi.string().valid('true', 'false').default('true'),
  ONCHAIN_INDEXER_ENABLED: Joi.string().valid('true', 'false').default('false'),
  INFURA_API_KEY: Joi.string().trim().optional(),
  ONCHAIN_SYNC_INTERVAL_MS: Joi.number().integer().min(5_000).default(30_000),
  ONCHAIN_MAX_CHAINS_PER_TICK: Joi.number().integer().min(1).max(100).default(10),

  RATE_LIMIT_RPM: Joi.number().integer().min(30).default(60),
  CORS_ORIGINS: Joi.string().default('*'),

  // ETag caching
  ENABLE_ETAG: Joi.string().valid('true', 'false').default('false'),
}).prefs({ convert: true, abortEarly: false });

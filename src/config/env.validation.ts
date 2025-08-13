import * as Joi from 'joi';

const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;

type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export type EnvVars = {
  NODE_ENV: NodeEnv;

  YELLOW_API_URL: string;
  YELLOW_WS_REQUEST_TIMEOUT_MS: number;
  YELLOW_WS_RECONNECT_BASE_MS: number;
  YELLOW_WS_RECONNECT_MAX_MS: number;
  SYNC_ASSETS_REFRESH_MS: number;

  SYNC_INTERVAL_MS: number;
  SYNC_FULL_SLEEP_MS: number;
  SYNC_CHANNELS_LIMIT: number;
  SYNC_TXS_PAGE_SIZE: number;
  SYNC_TXS_BUDGET_MS: number;

  RATE_LIMIT_RPM: number;
  CORS_ORIGINS: string;
};

export const envValidationSchema: Joi.ObjectSchema<EnvVars> = Joi.object<EnvVars>({
  NODE_ENV: Joi.string()
    .valid(...NODE_ENV_VALUES)
    .default('development'),

  YELLOW_API_URL: Joi.string()
    .uri({ scheme: ['ws', 'wss'] })
    .required(),
  YELLOW_WS_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(90_000),
  YELLOW_WS_RECONNECT_BASE_MS: Joi.number().integer().min(100).default(1_000),
  YELLOW_WS_RECONNECT_MAX_MS: Joi.number().integer().min(1_000).default(60_000),
  SYNC_ASSETS_REFRESH_MS: Joi.number()
    .integer()
    .min(10_000)
    .default(30 * 60 * 1000),

  SYNC_INTERVAL_MS: Joi.number().integer().min(5_000).default(90_000),
  SYNC_FULL_SLEEP_MS: Joi.number().integer().min(0).default(3_000),
  SYNC_CHANNELS_LIMIT: Joi.number().integer().min(10).max(1000).default(100),
  SYNC_TXS_PAGE_SIZE: Joi.number().integer().min(50).max(1000).default(200),
  SYNC_TXS_BUDGET_MS: Joi.number().integer().min(1000).default(10_000),

  RATE_LIMIT_RPM: Joi.number().integer().min(30).default(60),
  CORS_ORIGINS: Joi.string().default('*'),
}).prefs({ convert: true, abortEarly: false });

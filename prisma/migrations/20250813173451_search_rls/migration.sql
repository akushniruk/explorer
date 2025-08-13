-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- =========================
-- Advanced indexes for search
-- =========================

-- Channels
CREATE INDEX IF NOT EXISTS idx_channels_wallet ON channels (wallet);
CREATE INDEX IF NOT EXISTS idx_channels_participant ON channels (participant);
CREATE INDEX IF NOT EXISTS idx_channels_token_chain ON channels (token, chain_id);
CREATE INDEX IF NOT EXISTS idx_channels_status_updated ON channels (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_channels_created_desc ON channels (created_at DESC);
-- Fuzzy/prefix on id
CREATE INDEX IF NOT EXISTS idx_channels_channel_id_trgm
  ON channels USING gin (channel_id gin_trgm_ops);

-- Assets (create ONE index depending on column type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='assets' AND column_name='symbol' AND data_type='citext'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_assets_symbol_trgm
      ON assets USING gin (symbol gin_trgm_ops);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_assets_symbol_trgm
      ON assets USING gin (lower(symbol) gin_trgm_ops);
  END IF;
END $$;

-- Networks (create ONE index depending on column type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='networks' AND column_name='name' AND data_type='citext'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_networks_name_trgm
      ON networks USING gin (name gin_trgm_ops);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_networks_name_trgm
      ON networks USING gin (lower(name) gin_trgm_ops);
  END IF;
END $$;

-- Ledgers (time/range scans)
CREATE INDEX IF NOT EXISTS idx_ledgers_account_created ON ledgers (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_wallet_created  ON ledgers (wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_asset_created   ON ledgers (asset_symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_created_brin    ON ledgers USING brin (created_at) WITH (pages_per_range = 64);

-- AppSessions (arrays + fuzzy session_id)
CREATE INDEX IF NOT EXISTS idx_app_sessions_channel ON app_sessions (channel_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_status_updated ON app_sessions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_sessions_session_id_trgm
  ON app_sessions USING gin (session_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_app_sessions_participants_gin
  ON app_sessions USING gin (participants);

-- RpcStore telemetry/search
CREATE INDEX IF NOT EXISTS idx_rpc_store_req_id ON rpc_store (req_id);
CREATE INDEX IF NOT EXISTS idx_rpc_store_method_ts ON rpc_store (method, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rpc_store_sender_ts ON rpc_store (sender, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rpc_store_ts_brin ON rpc_store USING brin (timestamp);

-- =========================
-- Row-Level Security (RLS)
-- =========================

-- (A) roles (use NOLOGIN group roles; attach real login roles in ops)
DO $$ BEGIN
  CREATE ROLE api_user NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE worker_user NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (B) enable RLS on public-read tables
ALTER TABLE assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- (C) policies
-- api_user: read all assets/networks; channels only open/active
DO $$ BEGIN
  CREATE POLICY assets_read_api
    ON assets FOR SELECT
    TO api_user
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY networks_read_api
    ON networks FOR SELECT
    TO api_user
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY channels_read_api
    ON channels FOR SELECT
    TO api_user
    USING (status IN ('active','open'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optionally, the worker can see everything (no restriction) if needed:
DO $$ BEGIN
  CREATE POLICY channels_read_worker
    ON channels FOR SELECT
    TO worker_user
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (D) baseline grants (RLS still applies)
GRANT SELECT ON assets, networks, channels TO api_user, worker_user;

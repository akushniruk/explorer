-- 1) API login (read-only identity)
DO $$ BEGIN
  CREATE ROLE explorer_api LOGIN PASSWORD 'REPLACE_ME_STRONG_API';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Enable RLS (idempotent)
ALTER TABLE assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE networks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc_store     ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_config   ENABLE ROW LEVEL SECURITY;

-- 3) Baseline SELECT grants (RLS still applies)
GRANT SELECT ON assets, networks, channels, ledgers, rpc_store, node_config TO explorer_api;

-- 4) Simple allow-all SELECT policies for API (MVP)
DO $$ BEGIN
  CREATE POLICY api_assets_sel     ON assets      FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_networks_sel   ON networks    FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_channels_sel   ON channels    FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_ledgers_sel    ON ledgers     FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_rpc_store_sel  ON rpc_store   FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY api_node_config_sel ON node_config FOR SELECT TO explorer_api USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

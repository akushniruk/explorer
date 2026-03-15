-- ARC001: node.v1.get_config persistence surfaces (additive, non-breaking)

ALTER TABLE "nodes"
  ADD COLUMN IF NOT EXISTS "node_runtime_version" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "supported_sig_validators_base64" TEXT,
  ADD COLUMN IF NOT EXISTS "last_config_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_config_raw_payload" JSONB;

CREATE INDEX IF NOT EXISTS "nodes_last_config_at_idx" ON "nodes"("last_config_at");

ALTER TABLE "onchain_chain_configs"
  ADD COLUMN IF NOT EXISTS "locking_contract_address" VARCHAR(255);

CREATE TABLE IF NOT EXISTS "node_blockchain_configs" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(128),
  "channel_hub_address" VARCHAR(255),
  "locking_contract_address" VARCHAR(255),
  "raw_payload" JSONB,
  "last_config_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "node_blockchain_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "node_blockchain_configs_node_id_blockchain_id_key"
  ON "node_blockchain_configs"("node_id", "blockchain_id");
CREATE INDEX IF NOT EXISTS "node_blockchain_configs_node_id_updated_at_idx"
  ON "node_blockchain_configs"("node_id", "updated_at");
CREATE INDEX IF NOT EXISTS "node_blockchain_configs_blockchain_id_updated_at_idx"
  ON "node_blockchain_configs"("blockchain_id", "updated_at");

CREATE TABLE IF NOT EXISTS "node_config_snapshots" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "node_address" VARCHAR(255),
  "node_runtime_version" VARCHAR(128),
  "supported_sig_validators_base64" TEXT,
  "blockchains_json" JSONB NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "node_config_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "node_config_snapshots_node_id_captured_at_idx"
  ON "node_config_snapshots"("node_id", "captured_at");
CREATE INDEX IF NOT EXISTS "node_config_snapshots_captured_at_idx"
  ON "node_config_snapshots"("captured_at");

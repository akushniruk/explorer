-- ARC001 foundation tables (additive, non-breaking)

ALTER TABLE "nodes"
  ADD COLUMN IF NOT EXISTS "protocol_family" VARCHAR(64) NOT NULL DEFAULT 'clearnode',
  ADD COLUMN IF NOT EXISTS "protocol_version" VARCHAR(32) NOT NULL DEFAULT 'v0',
  ADD COLUMN IF NOT EXISTS "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "nodes_sync_enabled_idx" ON "nodes"("sync_enabled");
CREATE INDEX IF NOT EXISTS "nodes_is_primary_idx" ON "nodes"("is_primary");
CREATE INDEX IF NOT EXISTS "nodes_protocol_family_protocol_version_idx"
  ON "nodes"("protocol_family", "protocol_version");

CREATE TABLE IF NOT EXISTS "node_sync_state" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "cursor_json" JSONB,
  "last_success_at" TIMESTAMP(3),
  "last_error" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "node_sync_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "node_sync_state_node_id_resource_key"
  ON "node_sync_state"("node_id", "resource");
CREATE INDEX IF NOT EXISTS "node_sync_state_resource_updated_at_idx"
  ON "node_sync_state"("resource", "updated_at");
CREATE INDEX IF NOT EXISTS "node_sync_state_node_id_updated_at_idx"
  ON "node_sync_state"("node_id", "updated_at");

CREATE TABLE IF NOT EXISTS "onchain_chain_configs" (
  "chain_id" BIGINT NOT NULL,
  "channel_hub_address" VARCHAR(255) NOT NULL,
  "rpc_url" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "start_block" BIGINT,
  "last_synced_block" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onchain_chain_configs_pkey" PRIMARY KEY ("chain_id")
);

CREATE INDEX IF NOT EXISTS "onchain_chain_configs_enabled_chain_id_idx"
  ON "onchain_chain_configs"("enabled", "chain_id");

CREATE TABLE IF NOT EXISTS "onchain_events" (
  "id" TEXT NOT NULL,
  "chain_id" BIGINT NOT NULL,
  "contract_address" VARCHAR(255) NOT NULL,
  "tx_hash" VARCHAR(255) NOT NULL,
  "log_index" INTEGER NOT NULL,
  "block_number" BIGINT NOT NULL,
  "block_timestamp" TIMESTAMP(3) NOT NULL,
  "event_name" VARCHAR(128) NOT NULL,
  "channel_id" TEXT,
  "user_wallet" VARCHAR(255),
  "node_address" VARCHAR(255),
  "raw_payload" JSONB NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onchain_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onchain_events_chain_id_tx_hash_log_index_key"
  ON "onchain_events"("chain_id", "tx_hash", "log_index");
CREATE INDEX IF NOT EXISTS "onchain_events_chain_id_block_number_idx"
  ON "onchain_events"("chain_id", "block_number");
CREATE INDEX IF NOT EXISTS "onchain_events_event_name_block_timestamp_idx"
  ON "onchain_events"("event_name", "block_timestamp");
CREATE INDEX IF NOT EXISTS "onchain_events_user_wallet_block_timestamp_idx"
  ON "onchain_events"("user_wallet", "block_timestamp");

CREATE TABLE IF NOT EXISTS "offchain_balance_snapshots" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "wallet" VARCHAR(255) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "offchain_balance" TEXT NOT NULL,
  "source_ref" VARCHAR(255),
  "raw_payload" JSONB,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offchain_balance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "offchain_balance_snapshots_wallet_captured_at_idx"
  ON "offchain_balance_snapshots"("wallet", "captured_at");
CREATE INDEX IF NOT EXISTS "offchain_balance_snapshots_node_id_captured_at_idx"
  ON "offchain_balance_snapshots"("node_id", "captured_at");
CREATE INDEX IF NOT EXISTS "offchain_balance_snapshots_asset_blockchain_id_captured_at_idx"
  ON "offchain_balance_snapshots"("asset", "blockchain_id", "captured_at");

CREATE TABLE IF NOT EXISTS "onchain_balance_snapshots" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "wallet" VARCHAR(255) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "onchain_balance" TEXT NOT NULL,
  "source_ref" VARCHAR(255),
  "raw_payload" JSONB,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onchain_balance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "onchain_balance_snapshots_wallet_captured_at_idx"
  ON "onchain_balance_snapshots"("wallet", "captured_at");
CREATE INDEX IF NOT EXISTS "onchain_balance_snapshots_node_id_captured_at_idx"
  ON "onchain_balance_snapshots"("node_id", "captured_at");
CREATE INDEX IF NOT EXISTS "onchain_balance_snapshots_asset_blockchain_id_captured_at_idx"
  ON "onchain_balance_snapshots"("asset", "blockchain_id", "captured_at");

CREATE TABLE IF NOT EXISTS "wallet_balance_latest" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "wallet" VARCHAR(255) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "offchain_balance" TEXT,
  "onchain_balance" TEXT,
  "balance_delta" TEXT,
  "offchain_as_of" TIMESTAMP(3),
  "onchain_as_of" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_balance_latest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_balance_latest_node_id_wallet_asset_blockchain_id_key"
  ON "wallet_balance_latest"("node_id", "wallet", "asset", "blockchain_id");
CREATE INDEX IF NOT EXISTS "wallet_balance_latest_wallet_updated_at_idx"
  ON "wallet_balance_latest"("wallet", "updated_at");
CREATE INDEX IF NOT EXISTS "wallet_balance_latest_node_id_updated_at_idx"
  ON "wallet_balance_latest"("node_id", "updated_at");

CREATE TABLE IF NOT EXISTS "asset_tokens" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "asset_symbol" VARCHAR(64) NOT NULL,
  "token_address" VARCHAR(255) NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "decimals" VARCHAR(32),
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_tokens_node_id_asset_symbol_token_address_blockchain_id_key"
  ON "asset_tokens"("node_id", "asset_symbol", "token_address", "blockchain_id");
CREATE INDEX IF NOT EXISTS "asset_tokens_asset_symbol_blockchain_id_idx"
  ON "asset_tokens"("asset_symbol", "blockchain_id");

CREATE TABLE IF NOT EXISTS "states" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "state_id" TEXT NOT NULL,
  "channel_id" TEXT,
  "user_wallet" VARCHAR(255) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "epoch" VARCHAR(64),
  "version" VARCHAR(64),
  "transition_type" VARCHAR(64),
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "states_node_id_state_id_key"
  ON "states"("node_id", "state_id");
CREATE INDEX IF NOT EXISTS "states_user_wallet_updated_at_idx"
  ON "states"("user_wallet", "updated_at");
CREATE INDEX IF NOT EXISTS "states_channel_id_updated_at_idx"
  ON "states"("channel_id", "updated_at");

CREATE TABLE IF NOT EXISTS "apps" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "app_id" TEXT NOT NULL,
  "owner_wallet" VARCHAR(255),
  "version" VARCHAR(64),
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "apps_node_id_app_id_key"
  ON "apps"("node_id", "app_id");
CREATE INDEX IF NOT EXISTS "apps_owner_wallet_updated_at_idx"
  ON "apps"("owner_wallet", "updated_at");

CREATE TABLE IF NOT EXISTS "app_allocations" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "app_session_id" TEXT NOT NULL,
  "participant" VARCHAR(255) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "amount" TEXT NOT NULL,
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "app_allocations_app_session_id_updated_at_idx"
  ON "app_allocations"("app_session_id", "updated_at");
CREATE INDEX IF NOT EXISTS "app_allocations_participant_updated_at_idx"
  ON "app_allocations"("participant", "updated_at");

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "wallet" VARCHAR(255) NOT NULL,
  "tx_id" TEXT NOT NULL,
  "blockchain_id" VARCHAR(64) NOT NULL,
  "asset" VARCHAR(64) NOT NULL,
  "tx_type" VARCHAR(64) NOT NULL,
  "amount" TEXT NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_node_id_source_tx_id_key"
  ON "transactions"("node_id", "source", "tx_id");
CREATE INDEX IF NOT EXISTS "transactions_wallet_created_at_idx"
  ON "transactions"("wallet", "created_at");
CREATE INDEX IF NOT EXISTS "transactions_source_created_at_idx"
  ON "transactions"("source", "created_at");
CREATE INDEX IF NOT EXISTS "transactions_asset_blockchain_id_created_at_idx"
  ON "transactions"("asset", "blockchain_id", "created_at");

CREATE TABLE IF NOT EXISTS "action_allowance_snapshots" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "wallet" VARCHAR(255) NOT NULL,
  "allowances_json" JSONB NOT NULL,
  "raw_payload" JSONB,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "action_allowance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "action_allowance_snapshots_wallet_captured_at_idx"
  ON "action_allowance_snapshots"("wallet", "captured_at");
CREATE INDEX IF NOT EXISTS "action_allowance_snapshots_node_id_captured_at_idx"
  ON "action_allowance_snapshots"("node_id", "captured_at");

CREATE TABLE IF NOT EXISTS "session_key_states" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "key_scope" VARCHAR(64) NOT NULL,
  "user_address" VARCHAR(255) NOT NULL,
  "session_key" VARCHAR(255) NOT NULL,
  "expires_at" VARCHAR(64),
  "raw_payload" JSONB,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_key_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_key_states_user_address_captured_at_idx"
  ON "session_key_states"("user_address", "captured_at");
CREATE INDEX IF NOT EXISTS "session_key_states_node_id_captured_at_idx"
  ON "session_key_states"("node_id", "captured_at");
CREATE INDEX IF NOT EXISTS "session_key_states_key_scope_captured_at_idx"
  ON "session_key_states"("key_scope", "captured_at");

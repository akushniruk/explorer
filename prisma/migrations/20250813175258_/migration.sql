-- DropIndex
DROP INDEX "idx_app_sessions_participants_gin";

-- DropIndex
DROP INDEX "idx_app_sessions_session_id_trgm";

-- DropIndex
DROP INDEX "idx_app_sessions_status_updated";

-- DropIndex
DROP INDEX "idx_channels_channel_id_trgm";

-- DropIndex
DROP INDEX "idx_channels_created_desc";

-- DropIndex
DROP INDEX "idx_channels_status_updated";

-- DropIndex
DROP INDEX "idx_ledgers_account_created";

-- DropIndex
DROP INDEX "idx_ledgers_asset_created";

-- DropIndex
DROP INDEX "idx_ledgers_created_brin";

-- DropIndex
DROP INDEX "idx_ledgers_wallet_created";

-- DropIndex
DROP INDEX "idx_rpc_store_method_ts";

-- DropIndex
DROP INDEX "idx_rpc_store_sender_ts";

-- DropIndex
DROP INDEX "idx_rpc_store_ts_brin";

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "symbol" SET DATA TYPE CITEXT;

-- AlterTable
ALTER TABLE "networks" ALTER COLUMN "name" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE INDEX "app_sessions_status_updated_at_idx" ON "app_sessions"("status", "updated_at");

-- CreateIndex
CREATE INDEX "channels_status_updated_at_idx" ON "channels"("status", "updated_at");

-- CreateIndex
CREATE INDEX "channels_created_at_idx" ON "channels"("created_at");

-- CreateIndex
CREATE INDEX "ledgers_account_id_created_at_idx" ON "ledgers"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledgers_wallet_created_at_idx" ON "ledgers"("wallet", "created_at");

-- CreateIndex
CREATE INDEX "ledgers_asset_symbol_created_at_idx" ON "ledgers"("asset_symbol", "created_at");

-- CreateIndex
CREATE INDEX "rpc_store_method_idx" ON "rpc_store"("method");

-- CreateIndex
CREATE INDEX "rpc_store_sender_idx" ON "rpc_store"("sender");

-- RenameIndex
ALTER INDEX "idx_app_sessions_channel" RENAME TO "app_sessions_channel_id_idx";

-- RenameIndex
ALTER INDEX "idx_channels_participant" RENAME TO "channels_participant_idx";

-- RenameIndex
ALTER INDEX "idx_channels_token_chain" RENAME TO "channels_token_chain_id_idx";

-- RenameIndex
ALTER INDEX "idx_channels_wallet" RENAME TO "channels_wallet_idx";

-- RenameIndex
ALTER INDEX "idx_rpc_store_req_id" RENAME TO "rpc_store_req_id_idx";

-- CreateTable
CREATE TABLE "channels" (
    "channel_id" TEXT NOT NULL,
    "chain_id" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "participant" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "challenge" BIGINT NOT NULL DEFAULT 0,
    "nonce" BIGINT NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "adjudicator" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("channel_id")
);

-- CreateTable
CREATE TABLE "assets" (
    "token" TEXT NOT NULL,
    "chain_id" BIGINT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" BIGINT NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("token","chain_id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" SERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "credit" DECIMAL(64,18) NOT NULL,
    "debit" DECIMAL(64,18) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'NitroRPC/0.2',
    "session_id" TEXT NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "participants" TEXT[],
    "weight" INTEGER[],
    "quorum" BIGINT NOT NULL DEFAULT 100,
    "version" BIGINT NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpc_store" (
    "id" SERIAL NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "req_id" BIGINT NOT NULL,
    "method" VARCHAR(255) NOT NULL,
    "params" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "req_sig" TEXT[],
    "response" TEXT NOT NULL,
    "res_sig" TEXT[],

    CONSTRAINT "rpc_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_sessions_session_id_key" ON "app_sessions"("session_id");

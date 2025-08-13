-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" TEXT NOT NULL,
    "tx_type" VARCHAR(32) NOT NULL,
    "from_account" VARCHAR(255) NOT NULL,
    "from_account_tag" VARCHAR(64),
    "to_account" VARCHAR(255) NOT NULL,
    "to_account_tag" VARCHAR(64),
    "asset_symbol" VARCHAR(64) NOT NULL,
    "amount" DECIMAL(64,18) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ledger_tx_from" ON "ledger_transactions"("from_account");

-- CreateIndex
CREATE INDEX "idx_ledger_tx_to" ON "ledger_transactions"("to_account");

-- CreateIndex
CREATE INDEX "idx_ledger_tx_asset" ON "ledger_transactions"("asset_symbol");

-- CreateIndex
CREATE INDEX "idx_ledger_tx_created_at" ON "ledger_transactions"("created_at");

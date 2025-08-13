-- CreateTable
CREATE TABLE "node_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "broker_address" VARCHAR(255) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "networks" (
    "chain_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "custody_address" VARCHAR(255) NOT NULL,
    "adjudicator_address" VARCHAR(255) NOT NULL,
    "broker_address" VARCHAR(255) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("chain_id")
);

-- CreateIndex
CREATE INDEX "networks_name_idx" ON "networks"("name");

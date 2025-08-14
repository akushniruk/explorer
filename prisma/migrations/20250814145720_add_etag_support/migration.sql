-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "app_sessions_updated_at_idx" ON "app_sessions"("updated_at");

-- CreateIndex
CREATE INDEX "assets_updated_at_idx" ON "assets"("updated_at");

-- CreateIndex
CREATE INDEX "channels_updated_at_idx" ON "channels"("updated_at");

-- CreateIndex
CREATE INDEX "networks_updated_at_idx" ON "networks"("updated_at");

-- CreateIndex
CREATE INDEX "nodes_updated_at_idx" ON "nodes"("updated_at");

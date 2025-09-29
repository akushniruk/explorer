-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "nodes_featured_idx" ON "nodes"("featured");

-- CreateEnum
CREATE TYPE "NodeRegion" AS ENUM ('europe', 'north_america', 'south_america', 'africa', 'asia_pacific', 'middle_east');

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ws_url" TEXT NOT NULL,
    "description" TEXT,
    "website_host" VARCHAR(255),
    "icon_key" VARCHAR(128),
    "country_code" VARCHAR(2) NOT NULL,
    "region" "NodeRegion" NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "available" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodes_slug_key" ON "nodes"("slug");

-- CreateIndex
CREATE INDEX "nodes_region_idx" ON "nodes"("region");

-- CreateIndex
CREATE INDEX "nodes_country_code_idx" ON "nodes"("country_code");

-- CreateIndex
CREATE INDEX "nodes_status_updated_at_idx" ON "nodes"("status", "updated_at");

-- CreateIndex
CREATE INDEX "nodes_latitude_longitude_idx" ON "nodes"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_name_ws_url_key" ON "nodes"("name", "ws_url");

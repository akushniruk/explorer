-- ARC001: enforce idempotent app allocation upserts

WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "node_id", "app_session_id", "participant", "asset"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS rn
  FROM "app_allocations"
)
DELETE FROM "app_allocations" a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "app_allocations_node_id_app_session_id_participant_asset_key"
  ON "app_allocations"("node_id", "app_session_id", "participant", "asset");

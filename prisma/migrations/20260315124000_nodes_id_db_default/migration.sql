CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "nodes"
ALTER COLUMN "id" SET DEFAULT replace(gen_random_uuid()::text, '-'::text, ''::text);

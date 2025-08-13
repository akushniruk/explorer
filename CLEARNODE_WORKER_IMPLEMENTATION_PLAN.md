### **PR Plan (P0 MVP)**

---

#### **PR1 — chore(db): add MVP tables & indexes (non-breaking)**

**Goal:** Introduce new read-model tables, add performance indexes, extend worker state for cursoring.

**Changes:**
*   Add new tables:
    *   `networks` (stores current broker/network config)
    *   `ledger_transactions` (activity feed, normalized + raw amounts)
*   Extend `worker_states` with an optional `cursor` column (keep `lastProcessedTimestamp` for backward compatibility).
*   Add indexes to hot paths (`channels`, `assets`, `rpc_store`, `app_sessions`).

**Checklist:**
*   [ ] Run `prisma migrate dev --name mvp_p0_schema` locally.
*   [ ] Verify migration is additive (no drops).
*   [ ] Generate Prisma client & compile.
*   [ ] Seed minimal `networks` rows (for active chains).
*   [ ] Smoke test reads/writes to new tables.

**Acceptance:**
*   Prisma compiles.
*   New tables visible.
*   Existing services untouched & still green.

---

#### **PR2 — feat(sync): introduce cursored ingestion and SyncState repo**

**Goal:** Move to cursor polling with time budgets; idempotent upserts.

**Changes:**
*   Add `SyncStateRepository` using `worker_states` (id pattern: `get_ledger_transactions:<chainId>`).
*   Implement `TransactionIngestService.pullAndUpsert({ budgetMs })` (loop pages until budget exhausted).
*   Idempotent upserts into `ledger_transactions` on `(tx_hash, chain_id)` unique.

**Checklist:**
*   [ ] Unit tests for cursor advancement & retry/backoff.
*   [ ] Duplicate page test (no dupes on replays).
*   [ ] Validate bigint handling (helpers).

**Acceptance:**
*   Local run ingests pages and resumes on restart.
*   No duplicate rows after reruns.

---

#### **PR3 — feat(api): public explorer endpoints with cursor pagination**

**Goal:** Expose minimal read API: config, assets, channels, transactions (+ optional SSE).

**Endpoints:**
*   `GET /v1/explorer/config`
*   `GET /v1/explorer/assets?chainId=…&cursor=…&limit=…`
*   `GET /v1/explorer/channels?chainId=…&status=…&cursor=…`
*   `GET /v1/explorer/transactions?chainId=…&asset=…&cursor=…&limit=…`
*   (Optional) `GET /v1/explorer/stream` (SSE latest tx ids)

**Checklist:**
*   [ ] Class-validator DTOs, whitelist pipes.
*   [ ] Cursor pagination contract `{ items, nextCursor }`.
*   [ ] OpenAPI docs for all routes.
*   [ ] 429 rate limit (e.g., 60 rpm per IP).

**Acceptance:**
*   e2e tests pass (Testcontainers).
*   p95 < 200ms on `/transactions` with warm cache.

---

#### **PR4 — feat/worker: small cron jobs with budgets + redlock**

**Goal:** Split monolithic sync into lightweight, safe crons.

**Changes:**
*   `@Cron`:
    *   `syncConfig` every 30m
    *   `syncAssets` every 30m/chain
    *   `syncChannels` every 2m/chain
    *   `syncTransactions` every 20s/chain (10s budget)
*   Redlock (optional) for horizontal scaling to prevent overlap.

**Checklist:**
*   [ ] Crons disabled in test env.
*   [ ] Budget respected under slow upstream.
*   [ ] Logs include operation, `chainId`, page counts.

**Acceptance:**
*   No overlapping runs (even with 2 instances).
*   Stable CPU/mem under steady state.

---

#### **PR5 — chore(ops): observability, health, and security hardening**

**Goal:** Production basics.

**Changes:**
*   Helmet, CORS allowlist, HPP, body size limit.
*   `@nestjs/terminus` liveness/readiness (DB + upstream circuit state).
*   Pino structured logs with request IDs.
*   OpenTelemetry traces/metrics + `/metrics` (Prometheus).
*   Config via `@nestjs/config`.

**Checklist:**
*   [ ] Health endpoints wired in k8s (if applicable).
*   [ ] Dashboards for error rate/latency.
*   [ ] 4xx/5xx log sampling reasonable.

**Acceptance:**
*   Green readiness in local/prod.
*   Traces visible for ingest and HTTP.

---

#### **PR6 — test: unit + e2e + smoke**

**Goal:** Cover the critical path.

**Checklist:**
*   **Unit:** mappers (RPC → models), upsert logic, cursor logic.
*   **e2e:** list endpoints w/ pagination determinism.
*   **k6 smoke:** `/transactions` @ 50 rps for 60s (no 5xx).

**Acceptance:**
*   All tests green in CI.
*   No dupes after re-ingest.

---

#### **PR7 — docs: runbooks & API**

**Goal:** Make it operable.

**Checklist:**
*   [ ] Runbook: backfill, reorg, stuck cursor recovery.
*   [ ] OpenAPI JSON + Redoc.
*   [ ] README quickstart + `.env.example`.

**Acceptance:**
*   New dev can run ingestion + query API in <10 minutes.

---

### **First-Pass Prisma Migration (pasteable schema)**

This is additive. It keeps your existing models intact, adds new ones, and layers indexes. Fields follow your `snake_case` + `@@map` convention.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DIRECT_URL")
}

/* =========================
   EXISTING MODELS (augmented)
   ========================= */

model Channel {
  channel_id  String   @id
  chain_id    BigInt
  token       String
  wallet      String
  participant String
  amount      BigInt
  status      String
  challenge   BigInt   @default(0)
  nonce       BigInt   @default(0)
  version     BigInt   @default(0)
  adjudicator String
  created_at  DateTime @default(now())
  updated_at  DateTime @default(now()) @updatedAt

  @@index([chain_id, status])
  @@index([participant])
  @@index([wallet])
  @@index([created_at])
  @@map("channels")
}

model Asset {
  token    String
  chain_id BigInt
  symbol   String
  decimals BigInt

  @@id([token, chain_id])
  @@index([chain_id, symbol])
  @@map("assets")
}

model Ledger {
  id           Int      @id @default(autoincrement())
  account_id   String
  account_type String
  asset_symbol String
  wallet       String
  credit       Decimal  @db.Decimal(64, 18)
  debit        Decimal  @db.Decimal(64, 18)
  created_at   DateTime @default(now())

  @@map("ledgers")
}

model AppSession {
  id           Int      @id @default(autoincrement())
  protocol     String   @default("NitroRPC/0.2")
  session_id   String   @unique
  channel_id   BigInt
  nonce        BigInt
  participants String[]
  weight       Int[]
  quorum       BigInt   @default(100)
  version      BigInt   @default(1)
  status       String
  created_at   DateTime @default(now())
  updated_at   DateTime @default(now()) @updatedAt

  @@index([status])
  @@index([channel_id])
  @@map("app_sessions")
}

model RpcStore {
  id        Int      @id @default(autoincrement())
  sender    String   @db.VarChar(255)
  req_id    BigInt
  method    String   @db.VarChar(255)
  params    String   @db.Text
  timestamp BigInt
  req_sig   String[] @db.Text
  response  String   @db.Text
  res_sig   String[] @db.Text

  @@index([req_id])
  @@index([method])
  @@map("rpc_store")
}

model WorkerState {
  id                     String   @id
  lastProcessedTimestamp BigInt
  cursor                 String?  // NEW: for cursor-based polling
  updated_at             DateTime @updatedAt

  @@map("worker_states")
}

/* =========================
   NEW MODELS FOR MVP
   ========================= */

model Network {
  chain_id       BigInt   @id
  name           String
  broker_address String
  custody        String
  adjudicator    String
  updated_at     DateTime @updatedAt

  @@map("networks")
}

model LedgerTransaction {
  id            String   @id                          // stable id; else compose externally
  chain_id      BigInt
  tx_hash       String
  from_account  String
  to_account    String
  token         String                                // token address or "native:<chainId>"
  amount_raw    Decimal  @db.Decimal(78, 0)          // raw units
  decimals      Int                                   // snapshot of decimals at ingest
  amount_num    Decimal  @db.Decimal(64, 18)          // normalized for queries
  tx_type       String
  occurred_at   DateTime                              // source timestamp
  ingested_at   DateTime @default(now())

  @@unique([tx_hash, chain_id], name: "tx_hash_chain_uq")
  @@index([chain_id, occurred_at])
  @@index([from_account])
  @@index([to_account])
  @@index([token])
  @@map("ledger_transactions")
}
```

If you prefer not to add `Network` yet, you can drop that model and read config directly from RPC, but it’s useful for caching & joins.

**Run:**
```bash
# 1) Create migration
npx prisma migrate dev --name mvp_p0_schema

# 2) Generate client
npx prisma generate
```

---

### **Seed (minimal)**

Create `prisma/seed.ts` (or extend yours) to upsert active networks:

```typescript
await prisma.network.upsert({
  where: { chain_id: 8453n },
  update: { name: 'Base', broker_address, custody, adjudicator },
  create: { chain_id: 8453n, name: 'Base', broker_address, custody, adjudicator },
});
```

---

### **Service layer tasks (after PR1)**

*   **`SyncStateRepository`**
    *   `get(key: string): Promise<{ cursor?: string; lastProcessedTimestamp?: bigint }>`
    *   `setCursor(key: string, cursor: string): Promise<void>`
    *   `setTimestamp(key: string, ts: bigint): Promise<void>`
*   **`TransactionIngestService`**
    *   `pullAndUpsert({ chainId, budgetMs, pageSize }): Promise<{ pages: number, items: number }>`
    *   Upsert rule: on conflict (`tx_hash`, `chain_id`) → update `occurred_at`, `amount_*`, `tx_type`
*   **Mappers**
    *   RPC → `LedgerTransaction` (ensure `amount_raw` as string → Decimal; snapshot decimals)
*   **`ChannelService`**
    *   Add filtered list with cursor: (`chain_id`, `status`) using `created_at` or synthetic cursor
*   **`AssetService`**
    *   List by chain with cursor (cursor can be (`token`, `chain_id`) or time-based if you add timestamps)

---

### **Controller DTOs (sketch)**

```typescript
export class ListTxDto {
  @IsOptional() @IsString() cursor?: string; // opaque
  @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number = 100;
  @IsOptional() @IsString() asset?: string;
  @IsOptional() @IsString() @Matches(/^\d+$/) chainId?: string; // parse to bigint
}

export class ListChannelsDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() chainId?: string;
}
```

**BigInt note:** Prisma returns `bigint`. Create a tiny util to serialize:

```typescript
export const toNumberSafe = (b: bigint) => {
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('overflow');
  return Number(b);
};
```

---

### **Rollback plan**

*   All changes in PR1 are additive; rollback is simply `prisma migrate reset` in non-prod or `DROP TABLE ...` for `ledger_transactions` / `networks` in a targeted rollback.
*   PR2+ only adds code paths. Feature-flag cron jobs via env (e.g., `SYNC_ENABLED=false`) to disable ingestion without redeploy.

---

### **Definition of Done (MVP)**

*   New schema deployed; ingestion runs with cursors; explorer endpoints serve data with cursor pagination.
*   No duplicate transactions after repeated pulls.
*   Health & metrics in place; p95 < 200ms on `/transactions` with 10k rows.

If you want, I can draft the exact commit bodies (with diffs) for PR1 + a minimal `TransactionIngestService` and `SyncStateRepository` so you can copy-paste into the repo.
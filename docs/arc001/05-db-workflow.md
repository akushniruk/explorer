## 6. DB Workflow (Write Path)

### 6.1 Offchain Worker

1. Load active nodes and resource cursors.
2. Pull paginated data from ClearNode with rate limits.
3. Normalize v0/v1 payloads to canonical rows.
4. Upsert using newest-source-timestamp rule.
5. Persist cursor/retry/error in `node_sync_state`.
6. Emit update events.

### 6.2 Onchain Worker

1. Load chain cursors (`from_block`) for enabled chains.
2. Fetch logs in bounded block windows.
3. Insert `onchain_events` idempotently (`chain_id + tx_hash + log_index` unique).
4. Extract discovered wallets/channels/nodes.
5. Enrich with required view calls.
6. Append onchain snapshots and transaction projections.
7. Advance cursor only after successful commit.

### 6.3 Enrichment Pipeline

1. Consume discovery queue items from onchain events.
2. Resolve node by event `node_address`, fallback to primary.
3. Query ClearNode wallet-scoped reads.
4. Persist offchain snapshots/history.
5. Upsert `wallet_balance_latest` with recalculated delta.

### 6.4 API Read Path

1. Resolve node (`nodeSlug` or primary).
2. Read from cache and `wallet_balance_latest`.
3. Return both balances + delta + source timestamps.
4. If stale, trigger refresh path (sync or async based on endpoint SLA).


## 5. Data Model (Additive ARC001)

### 5.1 Keep and Evolve

- `nodes`
- `channels`
- `assets`
- `networks`
- `app_sessions`
- `ledgers`

Legacy support tables retained in ARC001 (for zero-downtime coexistence):

- `worker_states`
- `node_config`
- `rpc_store`

### 5.2 Add

- `node_sync_state`
- `asset_tokens`
- `states`
- `apps`
- `app_allocations`
- `transactions` (with `source=offchain|onchain`)
- `onchain_events`
- `offchain_balance_snapshots`
- `onchain_balance_snapshots`
- `wallet_balance_latest`
- `action_allowance_snapshots`
- `session_key_states`

### 5.3 Deferred Cleanup (Not ARC001)

Any drops of legacy infra tables happen only after:

- parity validation,
- migration completion,
- rollback window expiry.


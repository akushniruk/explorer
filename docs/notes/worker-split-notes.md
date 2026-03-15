## Worker Split Notes

### What changed

| Area | Final |
| --- | --- |
| Offchain entrypoint | `src/worker.ts` (unchanged role) |
| Onchain entrypoint | `src/worker-onchain.ts` (new) |
| Offchain domain | `src/worker/*` |
| Onchain domain | `src/worker-onchain/*` |
| Offchain image | `Dockerfile.worker` |
| Onchain image | `Dockerfile.worker.onchain` |
| Compose services | `worker` + `worker-onchain` |
| Flag behavior | `OFFCHAIN_SYNC_ENABLED` now enforced in `WorkerService` |

### Diagram 1 - Code Ownership

```mermaid
flowchart TB
  SRC["src/"] --> OFF["worker.ts"]
  SRC --> ON["worker-onchain.ts"]

  OFF --> OFFMOD["worker/worker.module.ts"]
  OFFMOD --> OFFDOM["worker/* (channels/assets/app_sessions/etc)"]

  ON --> ONMOD["worker-onchain/worker-onchain.module.ts"]
  ONMOD --> ONSVC["worker-onchain/onchain-indexer.service.ts"]
  ONMOD --> ONCFG["worker-onchain/worker-onchain.config.ts"]
```

### Diagram 2 - Runtime (Compose)

```mermaid
flowchart LR
  PG[("Postgres")]

  subgraph OFFCHAIN["Offchain Runtime"]
    W1["worker service"]
    D1["Dockerfile.worker"]
    F1["OFFCHAIN_SYNC_ENABLED=true"]
    F2["ONCHAIN_INDEXER_ENABLED=false"]
    D1 --> W1
    F1 --> W1
    F2 --> W1
  end

  subgraph ONCHAIN["Onchain Runtime"]
    W2["worker-onchain service"]
    D2["Dockerfile.worker.onchain"]
    F3["OFFCHAIN_SYNC_ENABLED=false"]
    F4["ONCHAIN_INDEXER_ENABLED=true"]
    D2 --> W2
    F3 --> W2
    F4 --> W2
  end

  W1 --> PG
  W2 --> PG
```

### Diagram 3 - Offchain Flag Guard

```mermaid
sequenceDiagram
  autonumber
  participant BOOT as worker.ts
  participant MOD as WorkerModule
  participant SVC as WorkerService

  BOOT->>MOD: createApplicationContext
  MOD->>SVC: onModuleInit

  alt OFFCHAIN_SYNC_ENABLED=false
    SVC-->>SVC: log "offchain disabled"
    SVC-->>BOOT: return (no WS warmup, no schedule)
  else OFFCHAIN_SYNC_ENABLED=true
    SVC->>SVC: warmup + sync bootstrap
    SVC->>SVC: schedule interval job
  end
```

### Quick run

```bash
npm run start:worker
npm run start:worker:onchain
```

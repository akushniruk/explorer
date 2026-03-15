## 4. Runtime Architecture

### 4.1 Worker Responsibilities

| Worker | Scope | Source | Output |
| --- | --- | --- | --- |
| Offchain Sync Worker | Node-scoped canonical resources | ClearNode | channels, assets, networks, app_sessions, states, apps, offchain transactions, allowances, session key states |
| Onchain Indexer Worker | Chain-scoped contract truth | Infura + ChannelHub ABI | onchain events, channel lifecycle, onchain balances, onchain transactions |
| Wallet Enrichment Pipeline | Wallet hydration from discoveries | Discovery queue + ClearNode | enriched wallet context, offchain snapshots, latest dual-balance projection |

### 4.2 Node Routing Rule for Enrichment

When onchain discovery includes `(wallet, node_address)`:

1. Resolve explorer node by `node_address`.
2. Query that node first for offchain enrichment.
3. If missing/unhealthy, fallback to primary node.
4. Do not fan out to all nodes by default.

### 4.3 Protocol Handling Rule

Do not use one parser for both protocols.

- v0 client/parser remains for existing nodes.
- v1 client/parser is introduced separately.
- Node-level routing uses `protocol_family` + `protocol_version` from `nodes` config.


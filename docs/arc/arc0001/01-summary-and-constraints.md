# ARC001 - Multi-Node, Multi-Protocol Explorer (v0 + v1 + Onchain)

## 1. Summary

This ARC defines a non-breaking rollout where:

- v0 continues to run without regressions.
- v1 is added additively and coexists with v0.
- Onchain and offchain data are both first-class sources.
- Landing pages remain aggregated across nodes.
- Wallet views return both offchain and onchain balances, plus delta and history.

Core runtime components:

- Offchain Sync Worker (ClearNode WS JSON-RPC)
- Onchain Indexer Worker (ChannelHub via Infura)
- Wallet Enrichment Pipeline (onchain-discovered wallets -> ClearNode wallet queries)

## 2. Non-Breaking Coexistence Contract

Mandatory constraints in ARC001:

- No destructive schema drops that can break the current v0 worker/API paths.
- Existing v0 endpoints remain backward compatible.
- Existing v0 worker loop remains operational during rollout.
- v1 parser/client is introduced alongside v0 parser/client (not replacing it in-place).
- Read aggregation must handle mixed v0 + v1 + multi-node records deterministically.

Conflict rule:

- Same business ID from multiple sources: newest source `updated_at` wins.

Timestamp source rule (must be enforced):

- Offchain records use RPC payload timestamp (`updated_at` from source payload).
- Onchain records use chain block timestamp (not indexer wall clock).


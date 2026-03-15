## 11. Test Plan

- v0 non-regression on existing worker/API.
- v1 parser/client and mapping tests.
- onchain event idempotency tests.
- enrichment routing tests (event-node -> primary fallback).
- conflict-resolution tests for timestamp precedence.
- dual-balance correctness tests (divergence + convergence).
- load tests for enrichment bursts under rate limits.
- sandbox/mainnet isolation tests.


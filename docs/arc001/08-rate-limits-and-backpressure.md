## 9. Rate Limits and Backpressure

Defaults:

- ClearNode limiter per node: `<=8 req/s`, burst `16`.
- Infura:
- soft cap `2.4M credits/day` (80%)
- hard cap `2.85M credits/day` (95%)
- per-second guard `<=350 credits/s`

Backpressure strategy:

- Throttle non-critical backfills first.
- Keep cursor continuity and wallet freshness paths prioritized.


## 8. API Contract Changes (Additive)

Wallet responses must include:

- `wallet`
- `node_slug`
- `asset`
- `blockchain_id`
- `offchain_balance`
- `onchain_balance`
- `balance_delta`
- `display_funds`
- `funds_source`
- `offchain_as_of`
- `onchain_as_of`

Compatibility note:

- Existing v0 response fields are preserved.


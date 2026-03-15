## 3. External Interfaces (Locked)

### 3.1 ClearNode

Transport and limits:

- WebSocket JSON-RPC 2.0 at `/ws` (default `:7824`)
- Pagination `{ offset, limit<=1000, sort: asc|desc }`
- Node baseline limits: `10 req/s`, burst `20`
- Metrics endpoint: `GET /metrics` on `:4242`

Explorer read methods:

- `node.v1`: `ping`, `get_config`, `get_assets`
- `user.v1`: `get_balances`, `get_transactions`, `get_action_allowances`
- `channels.v1`: `get_home_channel`, `get_escrow_channel`, `get_channels`, `get_latest_state`, `get_last_key_states`
- `app_sessions.v1`: `get_app_definition`, `get_app_sessions`, `get_last_key_states`
- `apps.v1`: `get_apps`

### 3.2 ChannelHub Onchain

View calls:

- `getChannelData`
- `getChannelIds`
- `getOpenChannels`
- `getEscrowDepositData`
- `getEscrowWithdrawalData`
- `getEscrowDepositIds`
- `getAccountBalance`

Events to index:

- `ChannelCreated`, `ChannelDeposited`, `ChannelWithdrawn`, `ChannelCheckpointed`, `ChannelChallenged`, `ChannelClosed`
- Escrow lifecycle events
- Migration lifecycle events
- `NodeBalanceUpdated`, `FundsClaimed`

Initial chains:

- Polygon Amoy `80002`
- Sepolia `11155111`

Deployment metadata source:

- `contracts/deployments/<chainId>/...`


-- Drop unused columns from onchain_chain_configs

ALTER TABLE "onchain_chain_configs" DROP COLUMN IF EXISTS "rpc_url";
ALTER TABLE "onchain_chain_configs" DROP COLUMN IF EXISTS "locking_contract_address";

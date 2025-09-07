-- CreateIndex
CREATE INDEX "channels_wallet_participant_idx" ON "channels"("wallet", "participant");

-- CreateIndex
CREATE INDEX "channels_participant_wallet_idx" ON "channels"("participant", "wallet");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_token_chain_id_fkey" FOREIGN KEY ("token", "chain_id") REFERENCES "assets"("token", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

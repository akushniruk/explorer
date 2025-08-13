-- AlterTable
ALTER TABLE "app_sessions" ADD COLUMN     "challenge" BIGINT,
ADD COLUMN     "session_data" TEXT,
ALTER COLUMN "channel_id" SET DATA TYPE TEXT;

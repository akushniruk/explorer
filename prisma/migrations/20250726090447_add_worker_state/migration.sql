-- CreateTable
CREATE TABLE "worker_states" (
    "id" TEXT NOT NULL,
    "lastProcessedTimestamp" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_states_pkey" PRIMARY KEY ("id")
);

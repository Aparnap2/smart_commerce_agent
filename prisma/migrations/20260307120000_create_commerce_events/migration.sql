-- CreateTable
CREATE TABLE "commerce_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "commerce_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_commerce_events_unprocessed" ON "commerce_events"("processed", "created_at") WHERE (processed = false);

-- CreateIndex
CREATE INDEX "idx_commerce_events_user" ON "commerce_events"("user_id", "created_at");

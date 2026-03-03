-- CreateTable
CREATE TABLE "agent_notifications" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_notifications_customer_id_read_idx" ON "agent_notifications"("customer_id", "read");

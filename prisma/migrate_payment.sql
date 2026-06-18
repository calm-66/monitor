-- Migration: Add PaymentEvent Table
-- Generated for Monitor project
-- Description: Add PaymentEvent table for tracking UsOnly payment events

-- Create PaymentEvent table
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" TEXT NOT NULL DEFAULT concat('pe_', gen_random_uuid()),
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PaymentEvent_eventType_idx" ON "PaymentEvent"("eventType");
CREATE INDEX IF NOT EXISTS "PaymentEvent_receivedAt_idx" ON "PaymentEvent"("receivedAt");
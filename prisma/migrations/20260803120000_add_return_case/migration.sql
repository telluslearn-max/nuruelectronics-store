-- CreateEnum
CREATE TYPE "ReturnCaseReason" AS ENUM ('change_of_mind', 'damaged', 'wrong_item', 'missing_item', 'warranty');

-- CreateEnum
CREATE TYPE "ReturnCaseStatus" AS ENUM ('approved', 'denied', 'escalated', 'refunded');

-- CreateTable
CREATE TABLE "ReturnCase" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "reason" "ReturnCaseReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReturnCaseStatus" NOT NULL,
    "decisionBasis" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL DEFAULT 'agent',
    "refundAmount" DECIMAL(10,2),
    "refundChannel" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnCase_shopifyOrderId_idx" ON "ReturnCase"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "ReturnCase_status_createdAt_idx" ON "ReturnCase"("status", "createdAt");

-- AlterEnum
-- Postgres requires new enum values to be added one statement at a time.
ALTER TYPE "CapitalCirclePositionStatus" ADD VALUE IF NOT EXISTS 'edge_rejected';
ALTER TYPE "CapitalCirclePositionStatus" ADD VALUE IF NOT EXISTS 'exited';

-- AlterTable
ALTER TABLE "CapitalCircleWallet" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedReason" TEXT;

-- AlterTable
ALTER TABLE "CapitalCirclePosition" ADD COLUMN     "edgePct" DECIMAL(6,4),
ADD COLUMN     "spreadAtEntry" DECIMAL(6,4),
ADD COLUMN     "bestAskAtEntry" DECIMAL(6,4),
ADD COLUMN     "fillPrice" DECIMAL(6,4),
ADD COLUMN     "feesUsd" DECIMAL(10,2),
ADD COLUMN     "kellyFraction" DECIMAL(6,4),
ADD COLUMN     "cycleId" TEXT,
ADD COLUMN     "marketEndDate" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "probEstimates" JSONB,
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "exitPrice" DECIMAL(6,4);

-- CreateTable
CREATE TABLE "CapitalCircleCycleLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'passed',
    "summary" TEXT NOT NULL DEFAULT '',
    "contextSnapshot" JSONB,
    "newsContext" TEXT,
    "positionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "CapitalCircleCycleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalCircleCandidateSnapshot" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "eventId" TEXT,
    "bestAsk" DECIMAL(6,4),
    "bestBid" DECIMAL(6,4),
    "spread" DECIMAL(6,4),
    "liquidityUsd" DECIMAL(14,2),
    "volume24hUsd" DECIMAL(14,2),
    "hoursToResolution" DECIMAL(8,2),
    "modelProbability" DECIMAL(6,4),
    "disagreement" DECIMAL(6,4),
    "traded" BOOLEAN NOT NULL DEFAULT false,
    "resolvedOutcome" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalCircleCandidateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapitalCirclePosition_marketId_resolvedAt_idx" ON "CapitalCirclePosition"("marketId", "resolvedAt");

-- CreateIndex
CREATE INDEX "CapitalCircleCycleLog_startedAt_idx" ON "CapitalCircleCycleLog"("startedAt");

-- CreateIndex
CREATE INDEX "CapitalCircleCandidateSnapshot_cycleId_idx" ON "CapitalCircleCandidateSnapshot"("cycleId");

-- CreateIndex
CREATE INDEX "CapitalCircleCandidateSnapshot_marketId_resolvedAt_idx" ON "CapitalCircleCandidateSnapshot"("marketId", "resolvedAt");

-- CreateIndex
CREATE INDEX "CapitalCircleCandidateSnapshot_resolvedAt_idx" ON "CapitalCircleCandidateSnapshot"("resolvedAt");

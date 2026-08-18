-- CreateEnum
CREATE TYPE "CapitalCircleSweepStatus" AS ENUM ('pending', 'confirmed');

-- CreateTable
CREATE TABLE "CapitalCircleSweep" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalProfitUsd" DECIMAL(10,2) NOT NULL,
    "splitPercent" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "sweepAmountUsd" DECIMAL(10,2) NOT NULL,
    "status" "CapitalCircleSweepStatus" NOT NULL DEFAULT 'pending',
    "confirmedUsdcAmount" DECIMAL(10,2),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "walletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalCircleSweep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapitalCircleSweep_weekStart_key" ON "CapitalCircleSweep"("weekStart");

-- CreateIndex
CREATE INDEX "CapitalCircleSweep_status_weekStart_idx" ON "CapitalCircleSweep"("status", "weekStart");

-- AddForeignKey
ALTER TABLE "CapitalCircleSweep" ADD CONSTRAINT "CapitalCircleSweep_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CapitalCircleWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

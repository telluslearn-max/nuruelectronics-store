-- CreateEnum
CREATE TYPE "CapitalCircleWalletStatus" AS ENUM ('pending', 'active', 'frozen');

-- CreateEnum
CREATE TYPE "CapitalCirclePositionStatus" AS ENUM ('simulated', 'approved', 'executed', 'rejected');

-- CreateTable
CREATE TABLE "CapitalCircleWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT,
    "chain" TEXT NOT NULL DEFAULT 'polygon',
    "status" "CapitalCircleWalletStatus" NOT NULL DEFAULT 'pending',
    "perTxCapUsd" DECIMAL(10,2),
    "dailyCapUsd" DECIMAL(10,2),
    "weeklyCapUsd" DECIMAL(10,2),
    "monthlyCapUsd" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalCircleWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalCirclePosition" (
    "id" TEXT NOT NULL,
    "walletId" TEXT,
    "venue" TEXT NOT NULL DEFAULT 'polymarket',
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT,
    "question" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "sizeUsd" DECIMAL(10,2) NOT NULL,
    "status" "CapitalCirclePositionStatus" NOT NULL DEFAULT 'simulated',
    "txHash" TEXT,
    "resultUsd" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CapitalCirclePosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapitalCircleWallet_address_key" ON "CapitalCircleWallet"("address");

-- CreateIndex
CREATE INDEX "CapitalCirclePosition_status_createdAt_idx" ON "CapitalCirclePosition"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CapitalCirclePosition_walletId_idx" ON "CapitalCirclePosition"("walletId");

-- AddForeignKey
ALTER TABLE "CapitalCirclePosition" ADD CONSTRAINT "CapitalCirclePosition_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CapitalCircleWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

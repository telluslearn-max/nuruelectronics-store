-- AlterTable
ALTER TABLE "CapitalCircleWallet" ADD COLUMN "circleWalletId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CapitalCircleWallet_circleWalletId_key" ON "CapitalCircleWallet"("circleWalletId");

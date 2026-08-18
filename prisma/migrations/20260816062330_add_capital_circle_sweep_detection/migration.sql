-- AlterTable
ALTER TABLE "CapitalCircleSweep" ADD COLUMN     "detectedAt" TIMESTAMP(3),
ADD COLUMN     "detectedTxHash" TEXT,
ADD COLUMN     "detectedUsdcAmount" DECIMAL(10,2);

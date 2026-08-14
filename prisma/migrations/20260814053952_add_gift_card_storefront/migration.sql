-- CreateEnum
CREATE TYPE "GiftCardCheckoutStatus" AS ENUM ('pending', 'paid', 'expired');

-- AlterEnum
ALTER TYPE "OrderSource" ADD VALUE 'mpesa_giftcard';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "usdToKesRate" DECIMAL(10,4),
ADD COLUMN     "usdToKesRateUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GiftCardOffering" (
    "id" TEXT NOT NULL,
    "reloadlyProductId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "reloadlyCountryCode" TEXT NOT NULL,
    "reloadlyCurrencyCode" TEXT NOT NULL,
    "denominationType" TEXT NOT NULL,
    "fixedDenominations" DECIMAL(10,2)[],
    "minDenomination" DECIMAL(10,2),
    "maxDenomination" DECIMAL(10,2),
    "markupPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCardOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardCheckout" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "denominationAmount" DECIMAL(10,2) NOT NULL,
    "priceKes" DECIMAL(10,2) NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "status" "GiftCardCheckoutStatus" NOT NULL DEFAULT 'pending',
    "checkoutCode" TEXT NOT NULL,
    "mpesaReceiptNumber" TEXT,
    "confirmedVia" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardOffering_reloadlyProductId_key" ON "GiftCardOffering"("reloadlyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardCheckout_checkoutCode_key" ON "GiftCardCheckout"("checkoutCode");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardCheckout_orderId_key" ON "GiftCardCheckout"("orderId");

-- CreateIndex
CREATE INDEX "GiftCardCheckout_status_idx" ON "GiftCardCheckout"("status");

-- AddForeignKey
ALTER TABLE "GiftCardCheckout" ADD CONSTRAINT "GiftCardCheckout_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "GiftCardOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardCheckout" ADD CONSTRAINT "GiftCardCheckout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

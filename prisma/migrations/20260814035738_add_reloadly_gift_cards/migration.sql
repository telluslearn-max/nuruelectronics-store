-- CreateEnum
CREATE TYPE "GiftCardFulfillmentStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "GiftCardProductMapping" (
    "id" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "shopifyProductTitle" TEXT NOT NULL,
    "reloadlyProductId" INTEGER NOT NULL,
    "reloadlyProductName" TEXT NOT NULL,
    "reloadlyCountryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardFulfillment" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "reloadlyProductId" INTEGER NOT NULL,
    "reloadlyTransactionId" TEXT,
    "status" "GiftCardFulfillmentStatus" NOT NULL DEFAULT 'pending',
    "cardNumber" TEXT,
    "pinCode" TEXT,
    "redemptionInstructions" TEXT,
    "amount" DECIMAL(10,2),
    "currencyCode" TEXT,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardProductMapping_shopifyVariantId_key" ON "GiftCardProductMapping"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardFulfillment_orderItemId_key" ON "GiftCardFulfillment"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardFulfillment_reloadlyTransactionId_key" ON "GiftCardFulfillment"("reloadlyTransactionId");

-- CreateIndex
CREATE INDEX "GiftCardFulfillment_orderItemId_idx" ON "GiftCardFulfillment"("orderItemId");

-- AddForeignKey
ALTER TABLE "GiftCardFulfillment" ADD CONSTRAINT "GiftCardFulfillment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

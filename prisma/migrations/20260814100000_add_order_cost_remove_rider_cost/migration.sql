-- AlterTable
ALTER TABLE "DeliveryNote" DROP COLUMN "riderCost";

-- CreateTable
CREATE TABLE "OrderCost" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderCost_orderId_idx" ON "OrderCost"("orderId");

-- AddForeignKey
ALTER TABLE "OrderCost" ADD CONSTRAINT "OrderCost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "DeliveryNote" ADD COLUMN "riderCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "DeliveryNote" ADD COLUMN "riderId" TEXT;

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

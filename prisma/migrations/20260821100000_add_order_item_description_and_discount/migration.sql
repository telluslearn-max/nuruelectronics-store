-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "description" TEXT,
ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;

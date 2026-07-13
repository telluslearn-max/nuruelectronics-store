/*
  Warnings:

  - Added the required column `paidFrom` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExpensePaymentSource" AS ENUM ('cash', 'mpesa', 'petty_cash');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidFrom" "ExpensePaymentSource" NOT NULL;

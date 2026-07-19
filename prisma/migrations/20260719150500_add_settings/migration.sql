-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "companyName" TEXT NOT NULL DEFAULT 'NURU Electronics',
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyAddress" TEXT,
    "logoUrl" TEXT,
    "defaultTaxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'KES',
    "documentNumberPrefixEstimate" TEXT,
    "documentNumberPrefixInvoice" TEXT,
    "documentNumberPrefixReceipt" TEXT,
    "documentNumberPrefixDeliveryNote" TEXT,
    "documentNumberPrefixBill" TEXT,
    "documentNumberPrefixPayslip" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

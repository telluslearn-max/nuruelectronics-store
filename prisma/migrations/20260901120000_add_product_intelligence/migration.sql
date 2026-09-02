-- CreateEnum
CREATE TYPE "SpecConfidence" AS ENUM ('verified', 'high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "IntelSourceType" AS ENUM ('nuru_csv', 'shopify_metafield', 'manufacturer', 'benchmark_db', 'ai_grounded', 'manual');

-- CreateTable
CREATE TABLE "ProductProfile" (
    "id" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "productFamily" TEXT,
    "model" TEXT,
    "generation" TEXT,
    "releaseYear" INTEGER,
    "dataCompleteness" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelSource" (
    "id" TEXT NOT NULL,
    "type" "IntelSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecValue" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "unit" TEXT,
    "confidence" "SpecConfidence" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfile_shopifyProductId_key" ON "ProductProfile"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfile_handle_key" ON "ProductProfile"("handle");

-- CreateIndex
CREATE INDEX "ProductProfile_category_idx" ON "ProductProfile"("category");

-- CreateIndex
CREATE INDEX "IntelSource_type_idx" ON "IntelSource"("type");

-- CreateIndex
CREATE INDEX "SpecValue_profileId_key_idx" ON "SpecValue"("profileId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SpecValue_profileId_key_sourceId_key" ON "SpecValue"("profileId", "key", "sourceId");

-- AddForeignKey
ALTER TABLE "SpecValue" ADD CONSTRAINT "SpecValue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProductProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecValue" ADD CONSTRAINT "SpecValue_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntelSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

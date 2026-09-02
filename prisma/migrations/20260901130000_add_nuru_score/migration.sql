-- CreateTable
CREATE TABLE "NuruScore" (
    "profileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "composite" DECIMAL(5,2),
    "scoredComponents" TEXT[],
    "coverage" JSONB NOT NULL,
    "formulaVersion" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NuruScore_pkey" PRIMARY KEY ("profileId")
);

-- CreateIndex
CREATE INDEX "NuruScore_category_idx" ON "NuruScore"("category");

-- AddForeignKey
ALTER TABLE "NuruScore" ADD CONSTRAINT "NuruScore_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProductProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

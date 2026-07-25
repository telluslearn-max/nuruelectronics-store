-- CreateTable
CREATE TABLE "ConciergeRequestLog" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConciergeRequestLog_ipAddress_createdAt_idx" ON "ConciergeRequestLog"("ipAddress", "createdAt");

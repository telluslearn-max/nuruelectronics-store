-- CreateTable
CREATE TABLE "LiveGradingSessionLog" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveGradingSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveGradingSessionLog_ipAddress_createdAt_idx" ON "LiveGradingSessionLog"("ipAddress", "createdAt");

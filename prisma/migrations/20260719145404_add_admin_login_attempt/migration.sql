-- CreateTable
CREATE TABLE "AdminLoginAttempt" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminLoginAttempt_createdAt_idx" ON "AdminLoginAttempt"("createdAt");

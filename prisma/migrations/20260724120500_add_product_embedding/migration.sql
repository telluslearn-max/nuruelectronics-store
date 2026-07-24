-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "handle" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("handle")
);

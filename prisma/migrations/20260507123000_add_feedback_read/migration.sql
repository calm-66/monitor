-- CreateTable
CREATE TABLE "FeedbackRead" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRead_eventId_key" ON "FeedbackRead"("eventId");

-- CreateIndex
CREATE INDEX "FeedbackRead_projectId_idx" ON "FeedbackRead"("projectId");

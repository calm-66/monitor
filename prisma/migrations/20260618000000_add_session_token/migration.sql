-- Create SessionToken table for dashboard sessions.
-- IF NOT EXISTS keeps deployment safe if the table was created manually before.
CREATE TABLE IF NOT EXISTS "SessionToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionToken_token_key" ON "SessionToken"("token");
CREATE INDEX IF NOT EXISTS "SessionToken_token_idx" ON "SessionToken"("token");

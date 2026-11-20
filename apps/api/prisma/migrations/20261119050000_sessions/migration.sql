CREATE TABLE "sessions" (
    "token_hash" CHAR(64) PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "transport" TEXT NOT NULL CHECK ("transport" IN ('cookie', 'bearer')),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sessions_expires_at_idx" ON "sessions" ("expires_at");

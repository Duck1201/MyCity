ALTER TABLE "reports"
    ADD COLUMN "photos_expire_at" TIMESTAMP(3),
    ADD COLUMN "photos_purged_at" TIMESTAMP(3);

CREATE INDEX "reports_photos_purged_at_photos_expire_at_idx"
    ON "reports" ("photos_purged_at", "photos_expire_at");

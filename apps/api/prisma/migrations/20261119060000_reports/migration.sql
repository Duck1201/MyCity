-- CreateEnum
CREATE TYPE "report_category" AS ENUM ('pothole', 'waste', 'lighting', 'debris', 'leak', 'tree');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('sent', 'under_review', 'in_progress', 'resolved', 'rejected', 'canceled');

-- CreateEnum
CREATE TYPE "location_source" AS ENUM ('gps', 'manual');

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "client_request_id" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "category" "report_category" NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location_source" "location_source" NOT NULL,
    "show_identity" BOOLEAN NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'sent',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_photos" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,

    CONSTRAINT "report_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_events" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to_status" "report_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_created_at_id_idx" ON "reports"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_author_id_client_request_id_key" ON "reports"("author_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_photos_report_id_position_key" ON "report_photos"("report_id", "position");

-- CreateIndex
CREATE INDEX "report_events_report_id_created_at_id_idx" ON "report_events"("report_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE reports ADD CONSTRAINT reports_valid_point CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
ALTER TABLE reports ADD CONSTRAINT reports_nonempty_description CHECK (length(trim(description)) > 0);
ALTER TABLE report_photos ADD CONSTRAINT report_photos_valid_image CHECK (position BETWEEN 0 AND 2 AND width BETWEEN 1 AND 1600 AND height BETWEEN 1 AND 1600 AND byte_size BETWEEN 1 AND 5242880);
ALTER TABLE report_events ADD CONSTRAINT report_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

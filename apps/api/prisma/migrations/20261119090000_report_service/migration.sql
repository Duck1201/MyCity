BEGIN;

-- AlterTable
ALTER TABLE "report_events" ADD COLUMN     "client_request_id" VARCHAR(128),
ADD COLUMN     "from_status" "report_status",
ADD COLUMN     "text" VARCHAR(2000),
ALTER COLUMN "to_status" DROP NOT NULL;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" "report_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_id_recipient_id_key" ON "notifications"("event_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_events_report_id_actor_id_client_request_id_key" ON "report_events"("report_id", "actor_id", "client_request_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "report_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE report_events ADD CONSTRAINT report_events_valid_content CHECK (
    (type = 'CREATED' AND from_status IS NULL AND to_status = 'sent' AND to_status IS NOT NULL AND text IS NULL AND client_request_id IS NULL)
    OR (type = 'STATUS_CHANGED' AND from_status IS NOT NULL AND to_status IS NOT NULL AND client_request_id IS NULL
        AND ((to_status = 'rejected' AND text IS NOT NULL AND length(trim(text)) > 0) OR (to_status <> 'rejected' AND text IS NULL)))
    OR (type = 'REPLY' AND from_status IS NULL AND to_status IS NULL AND text IS NOT NULL AND length(trim(text)) > 0 AND client_request_id IS NOT NULL)
);
COMMIT;

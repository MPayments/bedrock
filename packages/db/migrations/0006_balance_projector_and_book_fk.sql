ALTER TABLE "balance_positions"
  ALTER COLUMN "book_id" TYPE uuid USING "book_id"::uuid;
--> statement-breakpoint
ALTER TABLE "balance_holds"
  ALTER COLUMN "book_id" TYPE uuid USING "book_id"::uuid;
--> statement-breakpoint
ALTER TABLE "balance_events"
  ALTER COLUMN "book_id" TYPE uuid USING "book_id"::uuid;
--> statement-breakpoint

ALTER TABLE "balance_positions"
  ADD CONSTRAINT "balance_positions_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "balance_holds"
  ADD CONSTRAINT "balance_holds_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "balance_events"
  ADD CONSTRAINT "balance_events_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

DROP INDEX "balance_events_operation_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "balance_events_operation_subject_uq"
  ON "balance_events" USING btree ("operation_id","subject_type","subject_id","currency","event_type");
--> statement-breakpoint

CREATE TABLE "balance_projector_cursors" (
  "worker_key" text PRIMARY KEY NOT NULL,
  "last_posted_at" timestamp with time zone,
  "last_operation_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

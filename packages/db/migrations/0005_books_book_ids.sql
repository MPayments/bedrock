CREATE TABLE "books" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "counterparty_id" uuid,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books"
  ADD CONSTRAINT "books_counterparty_id_counterparties_id_fk"
  FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "books_code_uq" ON "books" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "books_counterparty_idx" ON "books" USING btree ("counterparty_id");
--> statement-breakpoint
CREATE INDEX "books_counterparty_default_idx"
  ON "books" USING btree ("counterparty_id","is_default");
--> statement-breakpoint

INSERT INTO "books" ("id", "counterparty_id", "code", "name", "is_default")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  NULL,
  'system',
  'System Ledger Book',
  true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "books" ("id", "counterparty_id", "code", "name", "is_default")
SELECT
  c."id",
  c."id",
  'counterparty:' || c."id"::text,
  COALESCE(NULLIF(c."short_name", ''), c."full_name", 'Book ' || c."id"::text),
  true
FROM "counterparties" c
ON CONFLICT ("id") DO UPDATE
SET
  "counterparty_id" = excluded."counterparty_id",
  "code" = excluded."code",
  "name" = excluded."name",
  "is_default" = excluded."is_default";
--> statement-breakpoint

ALTER TABLE "book_account_instances" RENAME COLUMN "book_org_id" TO "book_id";
--> statement-breakpoint
ALTER TABLE "postings" RENAME COLUMN "book_org_id" TO "book_id";
--> statement-breakpoint
ALTER INDEX "book_account_instances_org_currency_idx"
  RENAME TO "book_account_instances_book_currency_idx";
--> statement-breakpoint
ALTER INDEX "postings_org_currency_idx"
  RENAME TO "postings_book_currency_idx";
--> statement-breakpoint

ALTER TABLE "book_account_instances"
  ADD CONSTRAINT "book_account_instances_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "postings"
  ADD CONSTRAINT "postings_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "operational_account_bindings" ADD COLUMN "book_id" uuid;
--> statement-breakpoint
UPDATE "operational_account_bindings" oab
SET "book_id" = oa."counterparty_id"
FROM "operational_accounts" oa
WHERE oa."id" = oab."operational_account_id"
  AND oab."book_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "operational_account_bindings"
  ALTER COLUMN "book_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "operational_account_bindings"
  ADD CONSTRAINT "operational_account_bindings_book_id_books_id_fk"
  FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "operational_account_binding_book_idx"
  ON "operational_account_bindings" USING btree ("book_id");

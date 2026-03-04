ALTER TABLE "counterparty_accounts" ADD COLUMN "ledger_entity_counterparty_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "counterparty_accounts" ADD CONSTRAINT "counterparty_accounts_ledger_entity_counterparty_id_counterparties_id_fk" FOREIGN KEY ("ledger_entity_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "counterparty_accounts_ledger_entity_idx" ON "counterparty_accounts" USING btree ("ledger_entity_counterparty_id");
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_counterparty_id_counterparties_id_fk";
--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "counterparty_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "books_default_owner_uq" ON "books" USING btree ("counterparty_id") WHERE "is_default" = true;

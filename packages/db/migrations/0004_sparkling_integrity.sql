CREATE UNIQUE INDEX "fx_policies_name_uq" ON "fx_policies" USING btree ("name");
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_ledger_entry_id_journal_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;

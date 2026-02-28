ALTER TABLE "document_events"
ADD COLUMN "request_id" text;
--> statement-breakpoint
CREATE TABLE "accounting_pack_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_key" text NOT NULL,
  "version" integer NOT NULL,
  "checksum" text NOT NULL,
  "compiled_json" jsonb NOT NULL,
  "compiled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_pack_versions_pack_version_uq" ON "accounting_pack_versions" USING btree ("pack_key","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_pack_versions_checksum_uq" ON "accounting_pack_versions" USING btree ("checksum");
--> statement-breakpoint
CREATE INDEX "accounting_pack_versions_pack_compiled_idx" ON "accounting_pack_versions" USING btree ("pack_key","compiled_at");
--> statement-breakpoint
CREATE TABLE "accounting_pack_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" text DEFAULT 'book' NOT NULL,
  "scope_id" text NOT NULL,
  "pack_checksum" text NOT NULL,
  "effective_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_pack_assignments" ADD CONSTRAINT "accounting_pack_assignments_pack_checksum_accounting_pack_versions_checksum_fk" FOREIGN KEY ("pack_checksum") REFERENCES "public"."accounting_pack_versions"("checksum") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "accounting_pack_assignments_scope_effective_idx" ON "accounting_pack_assignments" USING btree ("scope_type","scope_id","effective_at");

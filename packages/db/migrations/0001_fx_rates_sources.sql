CREATE TABLE "fx_rate_sources" (
	"source" text PRIMARY KEY NOT NULL,
	"ttl_seconds" integer NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_published_at" timestamp with time zone,
	"last_status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

INSERT INTO "fx_rate_sources" ("source", "ttl_seconds", "last_status")
VALUES ('cbr', 86400, 'idle')
ON CONFLICT ("source") DO NOTHING;
--> statement-breakpoint

DELETE FROM "fx_rates" r
USING (
	SELECT id
	FROM (
		SELECT
			id,
			ROW_NUMBER() OVER (
				PARTITION BY source, base_currency_id, quote_currency_id, as_of
				ORDER BY created_at DESC, id DESC
			) AS rn
		FROM "fx_rates"
	) d
	WHERE d.rn > 1
) dupes
WHERE r.id = dupes.id;
--> statement-breakpoint

CREATE UNIQUE INDEX "fx_rates_source_pair_asof_uq"
ON "fx_rates" USING btree ("source", "base_currency_id", "quote_currency_id", "as_of");
--> statement-breakpoint

CREATE INDEX "fx_rates_source_asof_idx"
ON "fx_rates" USING btree ("source", "as_of");

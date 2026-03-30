CREATE TABLE "sub_agent_profiles" (
	"counterparty_id" uuid PRIMARY KEY NOT NULL,
	"commission_rate" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_clients" ADD COLUMN "sub_agent_counterparty_id" uuid;--> statement-breakpoint
ALTER TABLE "sub_agent_profiles" ADD CONSTRAINT "sub_agent_profiles_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_sub_agent_counterparty_id_counterparties_id_fk" FOREIGN KEY ("sub_agent_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "ops_clients" c
		LEFT JOIN "ops_sub_agents" s ON s."id" = c."sub_agent_id"
		WHERE c."sub_agent_id" IS NOT NULL
		  AND s."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Phase 11 migration failed: orphaned ops_clients.sub_agent_id references detected';
	END IF;
END
$$;--> statement-breakpoint

INSERT INTO "counterparties" (
	"id",
	"external_id",
	"customer_id",
	"relationship_kind",
	"short_name",
	"full_name",
	"description",
	"country",
	"kind"
)
SELECT
	gen_random_uuid(),
	'legacy:ops_sub_agent:' || s."id"::text,
	NULL,
	'external',
	s."name",
	s."name",
	NULL,
	NULL,
	'individual'
FROM "ops_sub_agents" s
WHERE NOT EXISTS (
	SELECT 1
	FROM "counterparties" c
	WHERE c."external_id" = 'legacy:ops_sub_agent:' || s."id"::text
);--> statement-breakpoint

INSERT INTO "sub_agent_profiles" (
	"counterparty_id",
	"commission_rate",
	"is_active"
)
SELECT
	c."id",
	s."commission"::numeric,
	true
FROM "ops_sub_agents" s
INNER JOIN "counterparties" c
	ON c."external_id" = 'legacy:ops_sub_agent:' || s."id"::text
LEFT JOIN "sub_agent_profiles" p
	ON p."counterparty_id" = c."id"
WHERE p."counterparty_id" IS NULL;--> statement-breakpoint

UPDATE "ops_clients" c
SET "sub_agent_counterparty_id" = cp."id"
FROM "ops_sub_agents" s
INNER JOIN "counterparties" cp
	ON cp."external_id" = 'legacy:ops_sub_agent:' || s."id"::text
WHERE c."sub_agent_id" = s."id"
  AND c."sub_agent_counterparty_id" IS DISTINCT FROM cp."id";

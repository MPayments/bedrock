CREATE TABLE "customer_memberships" (
	"customer_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_memberships_pk" PRIMARY KEY("customer_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "ops_clients" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
INSERT INTO "customers" ("id", "external_ref", "display_name", "description")
SELECT
	gen_random_uuid(),
	CONCAT('ops-client:', "ops_clients"."id"),
	"ops_clients"."org_name",
	'Backfilled from ops_clients'
FROM "ops_clients"
LEFT JOIN "customers"
	ON "customers"."external_ref" = CONCAT('ops-client:', "ops_clients"."id")
WHERE "customers"."id" IS NULL;--> statement-breakpoint
UPDATE "ops_clients"
SET "customer_id" = "customers"."id"
FROM "customers"
WHERE "customers"."external_ref" = CONCAT('ops-client:', "ops_clients"."id")
	AND "ops_clients"."customer_id" IS NULL;--> statement-breakpoint
INSERT INTO "customer_memberships" ("customer_id", "user_id")
SELECT
	"ops_clients"."customer_id",
	"ops_clients"."user_id"
FROM "ops_clients"
WHERE "ops_clients"."customer_id" IS NOT NULL
	AND "ops_clients"."user_id" IS NOT NULL
ON CONFLICT ("customer_id", "user_id") DO UPDATE
SET "updated_at" = now();--> statement-breakpoint
ALTER TABLE "customer_memberships" ADD CONSTRAINT "customer_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_memberships" ADD CONSTRAINT "customer_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_memberships_user_id_idx" ON "customer_memberships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;

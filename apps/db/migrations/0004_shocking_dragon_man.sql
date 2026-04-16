ALTER TABLE "payment_route_templates" ALTER COLUMN "source_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ALTER COLUMN "destination_entity_kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ALTER COLUMN "destination_entity_id" DROP NOT NULL;
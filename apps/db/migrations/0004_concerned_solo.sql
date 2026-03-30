ALTER TABLE "ops_contracts" DROP CONSTRAINT "ops_contracts_agent_organization_bank_details_id_ops_agent_organization_bank_details_id_fk";
--> statement-breakpoint
ALTER TABLE "ops_deals" DROP CONSTRAINT "ops_deals_agent_organization_bank_details_id_ops_agent_organization_bank_details_id_fk";
--> statement-breakpoint
ALTER TABLE "ops_contracts" DROP COLUMN "agent_organization_bank_details_id";--> statement-breakpoint
ALTER TABLE "ops_deals" DROP COLUMN "agent_organization_bank_details_id";
ALTER TABLE "ops_sub_agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_clients" DROP CONSTRAINT IF EXISTS "ops_clients_sub_agent_id_ops_sub_agents_id_fk";--> statement-breakpoint
DROP TABLE "ops_sub_agents";--> statement-breakpoint
ALTER TABLE "ops_clients" DROP COLUMN "sub_agent_id";

CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"assignee_user_id" text NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"deal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_tasks_assignee_sort_idx" ON "crm_tasks" USING btree ("assignee_user_id","sort_order");--> statement-breakpoint
CREATE INDEX "crm_tasks_due_date_idx" ON "crm_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "crm_tasks_completed_idx" ON "crm_tasks" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "crm_tasks_deal_idx" ON "crm_tasks" USING btree ("deal_id");
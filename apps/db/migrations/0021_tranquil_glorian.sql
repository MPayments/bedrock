CREATE TABLE "payment_step_artifacts" (
	"payment_step_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_step_artifacts_pk" PRIMARY KEY("payment_step_id","file_asset_id","purpose")
);
--> statement-breakpoint
ALTER TABLE "payment_step_artifacts" ADD CONSTRAINT "payment_step_artifacts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_idx" ON "payment_step_artifacts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_purpose_idx" ON "payment_step_artifacts" USING btree ("payment_step_id","purpose");
CREATE TABLE "agent_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tg_id" bigint,
	"user_name" text,
	"tag" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_allowed" boolean DEFAULT false NOT NULL,
	"allowed_by" text,
	"allowed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_tg_id_unique" UNIQUE("tg_id")
);
--> statement-breakpoint
CREATE TABLE "user_access_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_tg_id_unique";--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_allowed_by_user_id_fk" FOREIGN KEY ("allowed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_states" ADD CONSTRAINT "user_access_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_profiles_status_idx" ON "agent_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_profiles_is_allowed_idx" ON "agent_profiles" USING btree ("is_allowed");--> statement-breakpoint
CREATE INDEX "user_access_states_banned_idx" ON "user_access_states" USING btree ("banned");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "banned";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_reason";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_expires";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_enabled";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "tg_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "user_name";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "tag";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_allowed";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "allowed_by";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "allowed_at";
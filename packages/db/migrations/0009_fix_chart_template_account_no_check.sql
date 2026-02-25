ALTER TABLE "chart_template_accounts"
DROP CONSTRAINT IF EXISTS "chart_template_account_no_fmt";--> statement-breakpoint

ALTER TABLE "chart_template_accounts"
ADD CONSTRAINT "chart_template_account_no_fmt"
CHECK ("chart_template_accounts"."account_no" ~ '^[0-9]{2}([.][0-9]{2})?$');--> statement-breakpoint

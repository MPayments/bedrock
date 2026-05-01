ALTER TABLE "agreement_versions" ADD COLUMN "fee_billing_mode" text DEFAULT 'included_in_principal_invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_fee_billing_mode_chk" CHECK ("agreement_versions"."fee_billing_mode" in ('included_in_principal_invoice', 'separate_fee_invoice'));--> statement-breakpoint

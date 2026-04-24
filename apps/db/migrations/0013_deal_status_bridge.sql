ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'submitted';
--> statement-breakpoint
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'preparing_documents';
--> statement-breakpoint
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'awaiting_funds';
--> statement-breakpoint
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
--> statement-breakpoint
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'closing_documents';
--> statement-breakpoint
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'done';

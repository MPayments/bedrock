CREATE TABLE IF NOT EXISTS public.deal_quote_acceptances (
  id uuid PRIMARY KEY NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL,
  accepted_by_user_id text NOT NULL REFERENCES public."user"(id),
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  deal_revision integer NOT NULL,
  agreement_version_id uuid REFERENCES public.agreement_versions(id) ON DELETE SET NULL,
  replaced_by_quote_id uuid,
  revoked_at timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_quote_acceptances_deal_idx
  ON public.deal_quote_acceptances USING btree (deal_id, accepted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_quote_acceptances_quote_idx
  ON public.deal_quote_acceptances USING btree (quote_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS deal_quote_acceptances_deal_quote_uq
  ON public.deal_quote_acceptances USING btree (deal_id, quote_id);

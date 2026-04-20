DO $$
BEGIN
  IF to_regclass('public.deal_intake_snapshots') IS NULL THEN
    CREATE TABLE public.deal_intake_snapshots (
      deal_id uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
      revision integer NOT NULL,
      snapshot jsonb NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_revision_idx ON public.deal_intake_snapshots USING btree (revision);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_applicant_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'common' ->> 'applicantCounterpartyId')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_invoice_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'incomingReceipt' ->> 'invoiceNumber')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_contract_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'incomingReceipt' ->> 'contractNumber')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_requested_execution_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'common' ->> 'requestedExecutionDate')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_expected_at_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'incomingReceipt' ->> 'expectedAt')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_payer_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'incomingReceipt' ->> 'payerCounterpartyId')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deal_intake_snapshots_beneficiary_idx ON public.deal_intake_snapshots USING btree (((snapshot -> 'externalBeneficiary' ->> 'beneficiaryCounterpartyId')));
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'header_snapshot'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deals'
      AND column_name = 'header_revision'
  ) THEN
    INSERT INTO public.deal_intake_snapshots (
      deal_id,
      revision,
      snapshot,
      created_at,
      updated_at
    )
    SELECT
      d.id,
      d.header_revision,
      d.header_snapshot,
      d.created_at,
      d.updated_at
    FROM public.deals d
    WHERE d.header_snapshot IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.deal_intake_snapshots s
        WHERE s.deal_id = d.id
      );
  END IF;
END
$$;

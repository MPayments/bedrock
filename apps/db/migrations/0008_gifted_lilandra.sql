create table "deal_pricing_contexts" (
  "deal_id" uuid primary key not null references "deals"("id") on delete cascade,
  "revision" integer not null,
  "snapshot" jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index "deal_pricing_contexts_revision_idx"
  on "deal_pricing_contexts" using btree ("revision");
--> statement-breakpoint
insert into "deal_pricing_contexts" (
  "deal_id",
  "revision",
  "snapshot"
)
select
  d."id",
  1,
  jsonb_build_object(
    'commercialDraft',
    jsonb_build_object(
      'quoteMarkupBps', null,
      'fixedFeeAmount', null,
      'fixedFeeCurrency', null
    ),
    'fundingAdjustments',
    '[]'::jsonb,
    'routeAttachment',
    null
  )
from "deals" d
where not exists (
  select 1
  from "deal_pricing_contexts" c
  where c."deal_id" = d."id"
);

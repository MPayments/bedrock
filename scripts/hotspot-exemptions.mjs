export const HOTSPOT_EXEMPTIONS = {
  "apps/api/src/routes/deals.ts":
    "Deals router still needs a physical split into focused subrouters after the CRM projection SQL extraction.",
  "packages/modules/deals/src/adapters/drizzle/deal.reads.ts":
    "Deal reads still need a follow-up split into focused readers after the foreign-schema cleanup.",
  "packages/workflows/deal-projections/src/service.ts":
    "Deal projections still need a follow-up split into focused CRM/finance/portal projector modules.",
};

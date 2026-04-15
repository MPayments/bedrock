import {
  RouteComposerLookupContextSchema,
  type RouteComposerLookupContext,
} from "./contracts";

export const DEFAULT_PARTICIPANT_LOOKUP_LIMIT = 20;
export const MAX_PARTICIPANT_LOOKUP_LIMIT = 50;

export function getRouteComposerLookupContext(): RouteComposerLookupContext {
  return RouteComposerLookupContextSchema.parse({
    lookupDefaults: {
      defaultLimit: DEFAULT_PARTICIPANT_LOOKUP_LIMIT,
      maxLimit: MAX_PARTICIPANT_LOOKUP_LIMIT,
      prefixMatching: true,
    },
    participantKinds: [
      {
        backedBy: "customers",
        description: "Commercial account root and deal owner.",
        internalOnly: false,
        kind: "customer",
        label: "Customer",
        note: "Customers own deals and agreements, but customer legal entities are selected from counterparties.",
      },
      {
        backedBy: "counterparties",
        description: "External legal entities and persons, including customer-owned legal entities and beneficiaries.",
        internalOnly: false,
        kind: "counterparty",
        label: "Counterparty",
        note: "Use for customer legal entities, suppliers, beneficiaries, exporters, and payout destinations.",
      },
      {
        backedBy: "organizations",
        description: "Internal holding legal entities only.",
        internalOnly: true,
        kind: "organization",
        label: "Organization",
        note: "Organizations are never external counterparties.",
      },
      {
        backedBy: "sub_agent_profiles",
        description: "External sub-agents represented by a counterparty plus a canonical sub-agent profile.",
        internalOnly: false,
        kind: "sub_agent",
        label: "Sub-agent",
        note: "Sub-agents must exist as counterparties and have an active sub-agent profile.",
      },
    ],
    roleHints: [
      {
        description: "Commercial deal owner / account root.",
        id: "deal_owner",
        label: "Deal owner",
      },
      {
        description: "Customer-owned legal entity selected from counterparties.",
        id: "customer_legal_entity",
        label: "Customer legal entity",
      },
      {
        description: "Generic external party for suppliers, beneficiaries, exporters, and payout destinations.",
        id: "external_counterparty",
        label: "External counterparty",
      },
      {
        description: "Internal holding entity available for treasury routing.",
        id: "internal_entity",
        label: "Internal entity",
      },
      {
        description: "Internal organization suitable for balance and liquidity legs.",
        id: "liquidity_source",
        label: "Liquidity source",
      },
      {
        description: "External sub-agent with a canonical commission profile.",
        id: "sub_agent",
        label: "Sub-agent",
      },
    ],
    strictSemantics: {
      accessControlOwnedByIam: true,
      customerLegalEntitiesViaCounterparties: true,
      organizationsInternalOnly: true,
      subAgentsRequireCanonicalProfile: true,
    },
  });
}

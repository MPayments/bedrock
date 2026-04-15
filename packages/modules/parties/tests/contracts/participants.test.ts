import { describe, expect, it } from "vitest";

import {
  CustomerLegalEntitiesQuerySchema,
  ParticipantLookupQuerySchema,
  RouteComposerLookupContextSchema,
} from "../../src/contracts";

describe("participants contracts", () => {
  it("parses participant lookup query defaults", () => {
    const parsed = ParticipantLookupQuerySchema.parse({
      q: "  Ac  ",
      kind: "counterparty",
      limit: "12",
    });

    expect(parsed.q).toBe("Ac");
    expect(parsed.kind).toBe("counterparty");
    expect(parsed.limit).toBe(12);
    expect(parsed.activeOnly).toBe(true);
  });

  it("parses explicit boolean-like query values", () => {
    const parsed = ParticipantLookupQuerySchema.parse({
      activeOnly: "false",
      q: "",
    });

    expect(parsed.activeOnly).toBe(false);
  });

  it("parses customer legal entity lookup query", () => {
    const parsed = CustomerLegalEntitiesQuerySchema.parse({
      limit: "8",
      q: "  Legal  ",
    });

    expect(parsed.limit).toBe(8);
    expect(parsed.q).toBe("Legal");
  });

  it("accepts a route composer lookup context payload", () => {
    const parsed = RouteComposerLookupContextSchema.parse({
      lookupDefaults: {
        defaultLimit: 20,
        maxLimit: 50,
        prefixMatching: true,
      },
      participantKinds: [
        {
          backedBy: "customers",
          description: "Commercial account root.",
          internalOnly: false,
          kind: "customer",
          label: "Customer",
          note: null,
        },
      ],
      roleHints: [
        {
          description: "Deal owner.",
          id: "deal_owner",
          label: "Deal owner",
        },
      ],
      strictSemantics: {
        accessControlOwnedByIam: true,
        customerLegalEntitiesViaCounterparties: true,
        organizationsInternalOnly: true,
        subAgentsRequireCanonicalProfile: true,
      },
    });

    expect(parsed.lookupDefaults.maxLimit).toBe(50);
    expect(parsed.participantKinds[0]?.kind).toBe("customer");
    expect(parsed.roleHints[0]?.id).toBe("deal_owner");
  });
});

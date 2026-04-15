import { beforeEach, describe, expect, it, vi } from "vitest";

const headers = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/headers", () => ({
  headers,
}));

function createLookupContextPayload() {
  return {
    lookupDefaults: {
      defaultLimit: 20,
      maxLimit: 50,
      prefixMatching: true,
    },
    participantKinds: [
      {
        backedBy: "customers",
        description: "Commercial customer root",
        internalOnly: false,
        kind: "customer",
        label: "Клиент",
        note: null,
      },
      {
        backedBy: "organizations",
        description: "Internal treasury entity",
        internalOnly: true,
        kind: "organization",
        label: "Организация",
        note: null,
      },
    ],
    roleHints: [],
    strictSemantics: {
      accessControlOwnedByIam: true,
      customerLegalEntitiesViaCounterparties: true,
      organizationsInternalOnly: true,
      subAgentsRequireCanonicalProfile: true,
    },
  };
}

function createCurrenciesPayload() {
  return {
    data: [
      {
        code: "RUB",
        id: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        label: "RUB · Российский рубль",
        name: "Российский рубль",
      },
      {
        code: "USD",
        id: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        label: "USD · Доллар США",
        name: "Доллар США",
      },
    ],
  };
}

function createRouteTemplatePayload() {
  return {
    code: "rub-aed-usd-payout",
    costComponents: [
      {
        basisType: "deal_source_amount",
        bps: "15",
        classification: "expense",
        code: "liquidity_fee",
        currencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        family: "provider_fee",
        fixedAmountMinor: null,
        formulaType: "bps",
        id: "c14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        includedInClientRate: false,
        legCode: "fx",
        manualAmountMinor: null,
        notes: null,
        perMillion: null,
        roundingMode: "half_up",
        sequence: 1,
      },
    ],
    createdAt: "2026-04-01T08:00:00.000Z",
    dealType: "payment",
    description: "RUB collection -> AED transfer -> USD payout",
    id: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    legs: [
      {
        code: "collect",
        executionCounterpartyId: null,
        expectedFromAmountMinor: "12500000",
        expectedRateDen: null,
        expectedRateNum: null,
        expectedToAmountMinor: "12500000",
        fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        fromParticipantCode: "customer",
        id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        idx: 1,
        kind: "collection",
        notes: null,
        settlementModel: "incoming_receipt",
        toCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        toParticipantCode: "ops",
      },
    ],
    name: "RUB -> USD payout",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Customer",
        id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        requisiteId: null,
        role: "source_customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party",
        code: "ops",
        displayNameTemplate: "Multihansa",
        id: "b24fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        metadata: {},
        partyId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        partyKind: "organization",
        requisiteId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        role: "treasury_hub",
        sequence: 2,
      },
    ],
    status: "draft",
    updatedAt: "2026-04-02T08:00:00.000Z",
  };
}

describe("route template queries", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    headers.mockReset();

    headers.mockResolvedValue(
      new Headers({
        cookie: "session=token",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  it("lists route templates and sorts them by updatedAt desc", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          code: "older-template",
          createdAt: "2026-04-01T08:00:00.000Z",
          dealType: "payment",
          description: null,
          id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          name: "Older",
          status: "published",
          updatedAt: "2026-04-01T08:00:00.000Z",
        },
        {
          code: "newer-template",
          createdAt: "2026-04-02T08:00:00.000Z",
          dealType: "payment",
          description: null,
          id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          name: "Newer",
          status: "draft",
          updatedAt: "2026-04-03T08:00:00.000Z",
        },
      ],
    });

    const { listFinanceRouteTemplates } = await import(
      "@/features/treasury/route-templates/lib/queries"
    );

    const result = await listFinanceRouteTemplates({
      dealType: "payment",
      status: ["draft", "published"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/route-composer/templates?dealType=payment&status=draft&status=published",
      expect.any(Object),
    );
    expect(result.map((item) => item.name)).toEqual(["Newer", "Older"]);
  });

  it("loads route template workspace for an existing template", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createLookupContextPayload(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createCurrenciesPayload(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createRouteTemplatePayload(),
      });

    const { getFinanceRouteTemplateWorkspaceById } = await import(
      "@/features/treasury/route-templates/lib/queries"
    );

    const result = await getFinanceRouteTemplateWorkspaceById(
      "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/route-composer/lookup-context",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/currencies/options",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/v1/route-composer/templates/914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      expect.any(Object),
    );
    expect(result).not.toBeNull();
    expect(result?.currencies[0]?.code).toBe("RUB");
    expect(result?.lookupContext.participantKinds).toHaveLength(2);
    expect(result?.template?.name).toBe("RUB -> USD payout");
    expect(result?.template?.participants[0]?.code).toBe("customer");
  });

  it("loads a new route template workspace without template fetch", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createLookupContextPayload(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createCurrenciesPayload(),
      });

    const { getFinanceRouteTemplateWorkspaceById } = await import(
      "@/features/treasury/route-templates/lib/queries"
    );

    const result = await getFinanceRouteTemplateWorkspaceById("new");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        template: null,
      }),
    );
  });
});

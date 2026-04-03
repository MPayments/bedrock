import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    crm: {
      api: {
        userHasPermission,
      },
    },
    finance: {
      api: {
        userHasPermission,
      },
    },
    portal: {
      api: {
        userHasPermission,
      },
    },
  },
}));

import { treasuryOperationsRoutes } from "../../src/routes/treasury-operations";

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function createRequisite(input: {
  id: string;
  label: string;
  providerId?: string | null;
  accountNo?: string | null;
  iban?: string | null;
  beneficiaryName?: string | null;
}) {
  return {
    accountNo: input.accountNo ?? null,
    accountRef: null,
    address: null,
    assetCode: null,
    beneficiaryName: input.beneficiaryName ?? input.label,
    contact: null,
    corrAccount: null,
    iban: input.iban ?? null,
    id: input.id,
    kind: "bank",
    label: input.label,
    memoTag: null,
    network: null,
    notes: null,
    providerId: input.providerId ?? null,
    subaccountRef: null,
  };
}

function createOperation(input: {
  id: string;
  kind:
    | "payin"
    | "payout"
    | "fx_conversion"
    | "intracompany_transfer"
    | "intercompany_funding";
  dealId: string;
  createdAt: string;
  internalEntityOrganizationId?: string | null;
  quoteId?: string | null;
}) {
  return {
    amountMinor: "12500000",
    counterAmountMinor:
      input.kind === "fx_conversion" ? "1214375000" : null,
    counterCurrencyId:
      input.kind === "fx_conversion" ? uuid(202) : null,
    createdAt: new Date(input.createdAt),
    currencyId: uuid(201),
    customerId: uuid(301),
    dealId: input.dealId,
    id: input.id,
    internalEntityOrganizationId:
      input.internalEntityOrganizationId ?? uuid(401),
    kind: input.kind,
    quoteId: input.quoteId ?? null,
    sourceRef: `deal:${input.dealId}:leg:1:${input.kind}:1`,
    state: "planned",
    updatedAt: new Date(input.createdAt),
  };
}

function createWorkflow(input: {
  agreementId: string;
  applicantName: string;
  dealId: string;
  internalEntityName?: string;
  internalEntityOrganizationId?: string;
  kind:
    | "collect"
    | "convert"
    | "payout"
    | "transit_hold"
    | "settle_exporter";
  legState: "pending" | "ready" | "in_progress" | "done" | "blocked";
  operationId: string;
  operationKind:
    | "payin"
    | "payout"
    | "fx_conversion"
    | "intracompany_transfer"
    | "intercompany_funding";
  settlementDestinationRequisiteId?: string | null;
  settlementDestinationSnapshot?: {
    accountNo?: string | null;
    beneficiaryName?: string | null;
    iban?: string | null;
    label?: string | null;
    bankName?: string | null;
    bic?: string | null;
    corrAccount?: string | null;
    swift?: string | null;
  } | null;
  status:
    | "draft"
    | "awaiting_funds"
    | "awaiting_payment"
    | "closing_documents";
  transitionBlockers?: string[];
  type:
    | "payment"
    | "currency_exchange"
    | "currency_transit"
    | "exporter_settlement";
}) {
  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: [
      {
        id: uuid(Number(input.operationId.slice(-3)) + 600),
        idx: 1,
        kind: input.kind,
        operationRefs: [
          {
            kind: input.operationKind,
            operationId: input.operationId,
            sourceRef: `deal:${input.dealId}:leg:1:${input.operationKind}:1`,
          },
        ],
        state: input.legState,
      },
    ],
    intake: {
      common: {
        applicantCounterpartyId: null,
        customerNote: null,
        requestedExecutionDate: null,
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: null,
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: null,
        expectedAt: null,
        expectedCurrencyId: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Supplier payment",
        sourceAmount: "125000.00",
        sourceCurrencyId: uuid(201),
        targetCurrencyId: input.type === "currency_exchange" ? uuid(202) : null,
      },
      settlementDestination: {
        bankInstructionSnapshot: input.settlementDestinationSnapshot ?? null,
        mode: null,
        requisiteId: input.settlementDestinationRequisiteId ?? null,
      },
      type: input.type,
    },
    nextAction: "Prepare documents",
    operationalState: {
      capabilities: [],
      positions: input.legState === "blocked"
        ? [
            {
              amountMinor: null,
              kind: "provider_payable",
              reasonCode: "execution_pending",
              state: "blocked",
            },
          ]
        : [
            {
              amountMinor: null,
              kind: "customer_receivable",
              reasonCode: null,
              state:
                input.status === "awaiting_funds" ? "ready" : "pending",
            },
          ],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: uuid(301),
        displayName: input.applicantName,
        id: uuid(Number(input.operationId.slice(-3)) + 700),
        organizationId: null,
        role: "applicant",
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: input.internalEntityName ?? "Multihansa",
        id: uuid(Number(input.operationId.slice(-3)) + 701),
        organizationId: input.internalEntityOrganizationId ?? uuid(401),
        role: "internal_entity",
      },
    ],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agreementId: input.agreementId,
      agentId: null,
      calculationId: null,
      createdAt: new Date("2026-04-03T08:00:00.000Z"),
      id: input.dealId,
      status: input.status,
      type: input.type,
      updatedAt: new Date("2026-04-03T08:00:00.000Z"),
    },
    timeline: [],
    transitionReadiness: [
      {
        allowed: !input.transitionBlockers?.length,
        blockers: (input.transitionBlockers ?? []).map((message, index) => ({
          code: `blocker_${index + 1}`,
          message,
        })),
        targetStatus: "awaiting_funds",
      },
    ],
  };
}

function createTestApp() {
  const incomingOperation = createOperation({
    id: uuid(101),
    kind: "payin",
    dealId: uuid(501),
    createdAt: "2026-04-06T12:00:00.000Z",
  });
  const outgoingOperation = createOperation({
    id: uuid(102),
    kind: "payout",
    dealId: uuid(502),
    createdAt: "2026-04-05T12:00:00.000Z",
    quoteId: uuid(801),
  });
  const fxOperation = createOperation({
    id: uuid(103),
    kind: "fx_conversion",
    dealId: uuid(503),
    createdAt: "2026-04-04T12:00:00.000Z",
    quoteId: uuid(802),
  });
  const intracompanyOperation = createOperation({
    id: uuid(104),
    kind: "intracompany_transfer",
    dealId: uuid(504),
    createdAt: "2026-04-03T12:00:00.000Z",
  });
  const intercompanyOperation = createOperation({
    id: uuid(105),
    kind: "intercompany_funding",
    dealId: uuid(505),
    createdAt: "2026-04-02T12:00:00.000Z",
  });
  const blockedOperation = createOperation({
    id: uuid(106),
    kind: "payin",
    dealId: uuid(506),
    createdAt: "2026-04-05T11:00:00.000Z",
  });
  const failedOperation = createOperation({
    id: uuid(107),
    kind: "payout",
    dealId: uuid(507),
    createdAt: "2026-04-01T12:00:00.000Z",
  });

  const operations = [
    incomingOperation,
    outgoingOperation,
    fxOperation,
    intracompanyOperation,
    intercompanyOperation,
    blockedOperation,
    failedOperation,
  ];

  const agreementRequisite = createRequisite({
    id: uuid(901),
    label: "Internal USD",
    providerId: uuid(951),
    accountNo: "40702810900000000001",
  });
  const settlementRequisite = createRequisite({
    id: uuid(902),
    label: "Client RUB",
    providerId: uuid(952),
    iban: "RU0000000000000000000000001",
  });

  const workflowByDealId = new Map([
    [
      incomingOperation.dealId,
      createWorkflow({
        agreementId: uuid(601),
        applicantName: "ООО Вход",
        dealId: incomingOperation.dealId,
        kind: "collect",
        legState: "ready",
        operationId: incomingOperation.id,
        operationKind: incomingOperation.kind,
        status: "awaiting_funds",
        type: "payment",
      }),
    ],
    [
      outgoingOperation.dealId,
      createWorkflow({
        agreementId: uuid(602),
        applicantName: "ООО Выплата",
        dealId: outgoingOperation.dealId,
        kind: "payout",
        legState: "ready",
        operationId: outgoingOperation.id,
        operationKind: outgoingOperation.kind,
        settlementDestinationRequisiteId: settlementRequisite.id,
        status: "awaiting_payment",
        type: "currency_exchange",
      }),
    ],
    [
      fxOperation.dealId,
      createWorkflow({
        agreementId: uuid(603),
        applicantName: "ООО FX",
        dealId: fxOperation.dealId,
        kind: "convert",
        legState: "ready",
        operationId: fxOperation.id,
        operationKind: fxOperation.kind,
        status: "awaiting_payment",
        type: "currency_exchange",
      }),
    ],
    [
      intracompanyOperation.dealId,
      createWorkflow({
        agreementId: uuid(604),
        applicantName: "ООО Внутренний",
        dealId: intracompanyOperation.dealId,
        kind: "transit_hold",
        legState: "ready",
        operationId: intracompanyOperation.id,
        operationKind: intracompanyOperation.kind,
        status: "awaiting_payment",
        type: "currency_transit",
      }),
    ],
    [
      intercompanyOperation.dealId,
      createWorkflow({
        agreementId: uuid(605),
        applicantName: "ООО Межкомпани",
        dealId: intercompanyOperation.dealId,
        kind: "settle_exporter",
        legState: "ready",
        operationId: intercompanyOperation.id,
        operationKind: intercompanyOperation.kind,
        status: "awaiting_payment",
        type: "exporter_settlement",
      }),
    ],
    [
      blockedOperation.dealId,
      createWorkflow({
        agreementId: uuid(606),
        applicantName: "ООО Блокер",
        dealId: blockedOperation.dealId,
        kind: "collect",
        legState: "pending",
        operationId: blockedOperation.id,
        operationKind: blockedOperation.kind,
        status: "draft",
        transitionBlockers: ["Required intake sections are incomplete"],
        type: "payment",
      }),
    ],
    [
      failedOperation.dealId,
      createWorkflow({
        agreementId: uuid(607),
        applicantName: "ООО Ошибка",
        dealId: failedOperation.dealId,
        kind: "payout",
        legState: "blocked",
        operationId: failedOperation.id,
        operationKind: failedOperation.kind,
        settlementDestinationSnapshot: {
          accountNo: "30101810100000000001",
          beneficiaryName: "Beneficiary LLC",
          label: "Manual payout",
        },
        status: "awaiting_payment",
        type: "payment",
      }),
    ],
  ]);

  const agreementById = new Map(
    Array.from(workflowByDealId.values()).map((workflow, index) => [
      workflow.summary.agreementId,
      {
        id: workflow.summary.agreementId,
        organizationId:
          index === 4 ? uuid(402) : uuid(401),
        organizationRequisiteId: agreementRequisite.id,
      },
    ]),
  );

  const quoteDetailsById = new Map([
    [
      outgoingOperation.quoteId,
      {
        pricingTrace: {
          summary: "Provider route",
        },
        quote: {
          pricingMode: "explicit_route",
        },
      },
    ],
    [
      fxOperation.quoteId,
      {
        pricingTrace: {},
        quote: {
          pricingMode: "auto_cross",
        },
      },
    ],
  ]);

  const organizationsQueries = {
    listShortNamesById: vi.fn(async (ids: string[]) =>
      new Map(
        ids.map((id) => [
          id,
          id === uuid(401) ? "Multihansa" : "Bedrock Treasury",
        ]),
      ),
    ),
  };
  const requisitesQueries = {
    findById: vi.fn(async (id: string) => {
      if (id === agreementRequisite.id) {
        return agreementRequisite;
      }

      if (id === settlementRequisite.id) {
        return settlementRequisite;
      }

      return null;
    }),
    providers: {
      findById: vi.fn(async (id: string) => ({
        id,
        name: id === uuid(951) ? "Bank Alpha" : "Bank Beta",
      })),
    },
  };

  const list = vi.fn(async (input: {
    dealId?: string;
    internalEntityOrganizationId?: string;
    kind?: string[];
  }) => {
    let data = [...operations];

    if (input.dealId) {
      data = data.filter((operation) => operation.dealId === input.dealId);
    }

    if (input.internalEntityOrganizationId) {
      data = data.filter(
        (operation) =>
          operation.internalEntityOrganizationId ===
          input.internalEntityOrganizationId,
      );
    }

    if (input.kind?.length) {
      data = data.filter((operation) => input.kind?.includes(operation.kind));
    }

    data.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      data,
      limit: data.length,
      offset: 0,
      total: data.length,
    };
  });
  const findById = vi.fn(async (id: string) => {
    return operations.find((operation) => operation.id === id) ?? null;
  });

  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: null,
    });
    await next();
  });

  app.route(
    "/treasury/operations",
    treasuryOperationsRoutes({
      agreementsModule: {
        agreements: {
          queries: {
            findById: vi.fn(async (id: string) => agreementById.get(id) ?? null),
          },
        },
      },
      currenciesService: {
        findById: vi.fn(async (id: string) => ({
          code: id === uuid(202) ? "RUB" : "USD",
          id,
        })),
      },
      dealsModule: {
        deals: {
          queries: {
            findWorkflowsByIds: vi.fn(async (ids: string[]) =>
              ids
                .map((id) => workflowByDealId.get(id) ?? null)
                .filter((workflow): workflow is NonNullable<typeof workflow> => workflow !== null),
            ),
          },
        },
      },
      partiesReadRuntime: {
        organizationsQueries,
        requisitesQueries,
      },
      treasuryModule: {
        operations: {
          queries: {
            findById,
            list,
          },
        },
        quotes: {
          queries: {
            getQuoteDetails: vi.fn(
              async (input: { quoteRef: string }) =>
                quoteDetailsById.get(input.quoteRef) ?? null,
            ),
          },
        },
      },
    } as any),
  );

  return {
    app,
    list,
    findById,
  };
}

describe("treasury operations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it.each([
    ["incoming", "payin"],
    ["outgoing", "payout"],
    ["intracompany", "intracompany_transfer"],
    ["intercompany", "intercompany_funding"],
    ["fx", "fx_conversion"],
  ] as const)(
    "returns only %s operations for the saved view",
    async (view, expectedKind) => {
      const { app } = createTestApp();

      const response = await app.request(
        `http://localhost/treasury/operations?view=${view}`,
      );

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.data.length).toBeGreaterThan(0);
      expect(
        payload.data.every(
          (item: { kind: string }) => item.kind === expectedKind,
        ),
      ).toBe(true);
    },
  );

  it("filters the exceptions view before pagination and includes failed and blocked items", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/treasury/operations?view=exceptions&limit=1&offset=0",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: uuid(106),
          instructionStatus: "blocked",
          kind: "payin",
        }),
      ],
      limit: 1,
      offset: 0,
      total: 2,
      viewCounts: expect.objectContaining({
        all: 7,
        exceptions: 2,
      }),
    });
  });

  it("returns operation details with deal, leg, next action, and derived account summaries", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/operations/${uuid(102)}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        dealRef: expect.objectContaining({
          applicantName: "ООО Выплата",
          dealId: uuid(502),
          type: "currency_exchange",
        }),
        destinationAccount: expect.objectContaining({
          label: "Client RUB",
        }),
        legRef: expect.objectContaining({
          kind: "payout",
          legId: expect.any(String),
        }),
        nextAction: "Prepare documents",
        providerRoute: "Provider route",
        sourceAccount: expect.objectContaining({
          label: "Internal USD",
        }),
      }),
    );
  });

  it("returns 404 for unknown treasury operations", async () => {
    const { app, findById } = createTestApp();

    const response = await app.request(
      `http://localhost/treasury/operations/${uuid(999)}`,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Treasury operation not found",
    });
    expect(findById).toHaveBeenCalledWith(uuid(999));
  });
});

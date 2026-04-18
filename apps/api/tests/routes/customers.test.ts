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
  },
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { customersRoutes } from "../../src/routes/customers";

const IDS = {
  counterparty: "00000000-0000-4000-8000-000000000401",
  customer: "00000000-0000-4000-8000-000000000402",
} as const;

function createTestApp() {
  const now = new Date("2026-04-18T08:00:00.000Z");
  const customerRecord = {
    createdAt: now,
    description: "Workspace customer",
    externalRef: "C-402",
    id: IDS.customer,
    name: "Workspace Customer",
    updatedAt: now,
  };
  const counterpartyRecord = {
    country: "RU",
    createdAt: now,
    customerId: IDS.customer,
    description: null,
    externalRef: "CP-401",
    fullName: "Workspace Customer LLC",
    groupIds: [],
    id: IDS.counterparty,
    kind: "legal_entity",
    partyProfile: {
      contacts: [],
      identifiers: [{ scheme: "inn", value: "7701234567" }],
    },
    relationshipKind: "customer_owned",
    shortName: "Workspace Customer",
    updatedAt: now,
  };
  const activeAgreement = {
    createdAt: now,
    currentVersion: {
      contractDate: now,
      contractNumber: "AG-2026-001",
      createdAt: now,
      feeRules: [],
      id: "00000000-0000-4000-8000-000000000403",
      parties: [],
      updatedAt: now,
      versionNumber: 1,
    },
    customerId: IDS.customer,
    id: "00000000-0000-4000-8000-000000000404",
    isActive: true,
    organizationId: "00000000-0000-4000-8000-000000000405",
    organizationRequisiteId: "00000000-0000-4000-8000-000000000406",
    updatedAt: now,
  };
  const documentGenerationService = {
    generateCustomerContract: vi.fn(async () => ({
      buffer: Buffer.from("contract-pdf"),
      fileName: "contract.pdf",
      mimeType: "application/pdf",
    })),
  };
  const filesModule = {
    files: {
      commands: {
        persistGeneratedCounterpartyFile: vi.fn(async () => undefined),
      },
    },
  };
  const partiesModule = {
    customers: {
      queries: {
        findById: vi.fn(async () => customerRecord),
      },
    },
    counterparties: {
      queries: {
        findById: vi.fn(async (id: string) =>
          id === IDS.counterparty ? counterpartyRecord : null,
        ),
        list: vi.fn(async () => ({
          data: [counterpartyRecord],
          limit: 100,
          offset: 0,
          total: 1,
        })),
      },
    },
    subAgentProfiles: {
      queries: {
        findById: vi.fn(async () => ({
          commissionRate: 0.15,
          counterpartyId: "00000000-0000-4000-8000-000000000407",
          country: "RU",
          createdAt: now,
          fullName: "Sub Agent",
          isActive: true,
          kind: "legal_entity",
          shortName: "Sub Agent",
          updatedAt: now,
        })),
      },
    },
  };
  const partiesReadRuntime = {
    counterpartiesQueries: {
      listAssignmentsByCounterpartyIds: vi.fn(async () =>
        new Map([
          [
            IDS.counterparty,
            {
              counterpartyId: IDS.counterparty,
              subAgentCounterpartyId: "00000000-0000-4000-8000-000000000407",
            },
          ],
        ]),
      ),
    },
  };
  const agreementsModule = {
    agreements: {
      queries: {
        findById: vi.fn(async () => activeAgreement),
        list: vi.fn(async () => ({
          data: [activeAgreement],
          limit: 2,
          offset: 0,
          total: 1,
        })),
      },
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("audience", "crm");
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route(
    "/customers",
    customersRoutes({
      agreementsModule,
      documentGenerationService,
      filesModule,
      partiesModule,
      partiesReadRuntime,
    } as any),
  );

  return {
    app,
    agreementsModule,
    customerRecord,
    counterpartyRecord,
    documentGenerationService,
    filesModule,
    partiesModule,
    partiesReadRuntime,
  };
}

describe("customers routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("does not expose legacy customer legal-entity compatibility routes", async () => {
    const { app } = createTestApp();

    const detailResponse = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}`,
    );
    const listResponse = await app.request(
      `http://localhost/customers/${IDS.customer}/party-profiles`,
    );
    const bankProvidersResponse = await app.request(
      "http://localhost/customers/bank-providers?query=bank",
    );

    expect(detailResponse.status).toBe(404);
    expect(listResponse.status).toBe(404);
    expect(bankProvidersResponse.status).toBe(400);
  });

  it("delegates legal entity contract generation to the workflow and persists the generated file", async () => {
    const { app, documentGenerationService, filesModule } = createTestApp();

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/contract?format=pdf&lang=en`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("contract-pdf");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="contract.pdf"',
    );

    expect(
      documentGenerationService.generateCustomerContract,
    ).toHaveBeenCalledWith({
      counterpartyId: IDS.counterparty,
      customerId: IDS.customer,
      format: "pdf",
      lang: "en",
    });
    expect(
      filesModule.files.commands.persistGeneratedCounterpartyFile,
    ).toHaveBeenCalledWith({
      buffer: Buffer.from("contract-pdf"),
      createdBy: "user-1",
      fileName: "contract.pdf",
      fileSize: Buffer.byteLength("contract-pdf"),
      generatedFormat: "pdf",
      generatedLang: "en",
      linkKind: "legal_entity_contract",
      mimeType: "application/pdf",
      ownerId: IDS.counterparty,
    });
  });

  it("returns DOCX contracts and persists the generated DOCX file", async () => {
    const { app, documentGenerationService, filesModule } = createTestApp();

    documentGenerationService.generateCustomerContract.mockResolvedValueOnce({
      buffer: Buffer.from("contract-docx"),
      fileName: "contract.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/counterparties/${IDS.counterparty}/contract?format=docx&lang=ru`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("contract-docx");
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="contract.docx"',
    );

    expect(
      documentGenerationService.generateCustomerContract,
    ).toHaveBeenCalledWith({
      counterpartyId: IDS.counterparty,
      customerId: IDS.customer,
      format: "docx",
      lang: "ru",
    });
    expect(
      filesModule.files.commands.persistGeneratedCounterpartyFile,
    ).toHaveBeenCalledWith({
      buffer: Buffer.from("contract-docx"),
      createdBy: "user-1",
      fileName: "contract.docx",
      fileSize: Buffer.byteLength("contract-docx"),
      generatedFormat: "docx",
      generatedLang: "ru",
      linkKind: "legal_entity_contract",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ownerId: IDS.counterparty,
    });
  });

  it("returns the CRM customer workspace projection from canonical module reads", async () => {
    const {
      agreementsModule,
      app,
      partiesModule,
      partiesReadRuntime,
    } = createTestApp();

    const response = await app.request(
      `http://localhost/customers/${IDS.customer}/workspace`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      counterparties: [
        expect.objectContaining({
          counterpartyId: IDS.counterparty,
          fullName: "Workspace Customer LLC",
          inn: "7701234567",
          orgName: "Workspace Customer",
          relationshipKind: "customer_owned",
          subAgent: expect.objectContaining({
            counterpartyId: "00000000-0000-4000-8000-000000000407",
            shortName: "Sub Agent",
          }),
          subAgentCounterpartyId: "00000000-0000-4000-8000-000000000407",
        }),
      ],
      counterpartyCount: 1,
      createdAt: "2026-04-18T08:00:00.000Z",
      description: "Workspace customer",
      externalRef: "C-402",
      hasActiveAgreement: true,
      id: IDS.customer,
      name: "Workspace Customer",
      primaryCounterpartyId: IDS.counterparty,
      updatedAt: "2026-04-18T08:00:00.000Z",
    });
    expect(partiesModule.customers.queries.findById).toHaveBeenCalledWith(
      IDS.customer,
    );
    expect(agreementsModule.agreements.queries.list).toHaveBeenCalled();
    expect(
      partiesReadRuntime.counterpartiesQueries.listAssignmentsByCounterpartyIds,
    ).toHaveBeenCalledWith([IDS.counterparty]);
  });
});

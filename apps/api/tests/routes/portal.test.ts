import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/routes/counterparty-directory", () => ({
  lookupCompanyByInn: vi.fn(),
}));

const { portalService } = vi.hoisted(() => ({
  portalService: {
    assertOnboardingAccess: vi.fn(async () => createPortalProfile()),
    assertPortalAccess: vi.fn(async () => undefined),
    createCounterparty: vi.fn(),
    createDealDraft: vi.fn(async () => createPortalProjection()),
    getCustomerContexts: vi.fn(async () => ({
      data: [createPortalCustomerContext()],
      total: 1,
    })),
    getDealById: vi.fn(async () => createPortalDealDetail()),
    listMyDeals: vi.fn(async () => ({
      data: [],
      limit: 20,
      offset: 0,
      total: 0,
    })),
    searchBankProviders: vi.fn(async () => []),
  },
}));

import { portalRoutes } from "../../src/routes/portal";

const IDS = {
  agreement: "00000000-0000-4000-8000-000000000701",
  attachment: "00000000-0000-4000-8000-000000000702",
  customer: "00000000-0000-4000-8000-000000000703",
  deal: "00000000-0000-4000-8000-000000000704",
  user: "00000000-0000-4000-8000-000000000705",
} as const;

function createPortalProfile() {
  return {
    customers: [],
    hasOnboardingAccess: true,
    hasCrmAccess: false,
    hasCustomerPortalAccess: true,
    memberships: [],
  };
}

function createPortalCustomerContext() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    customer: {
      createdAt: now,
      description: null,
      externalRef: "ACME-001",
      id: IDS.customer,
      name: "ACME LLC",
      updatedAt: now,
    },
    counterparties: [],
  };
}

function createAgreementDetail() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: IDS.agreement,
    customerId: IDS.customer,
    organizationId: "00000000-0000-4000-8000-000000000706",
    organizationRequisiteId: "00000000-0000-4000-8000-000000000707",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: {
      id: "00000000-0000-4000-8000-000000000708",
      versionNumber: 1,
      contractNumber: "AG-2026-001",
      contractDate: now,
      feeRules: [],
      parties: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createPortalProjection(input?: {
  attachmentId?: string | null;
  fileName?: string | null;
}) {
  const now = new Date("2026-04-01T00:00:00.000Z").toISOString();

  return {
    attachments: input?.attachmentId
      ? [
          {
            createdAt: now,
            fileName: input.fileName ?? "invoice.pdf",
            id: input.attachmentId,
            ingestionStatus: "processing",
            purpose: "invoice",
          },
        ]
      : [],
    calculationSummary: null,
    customerSafeIntake: {
      contractNumber: null,
      customerNote: null,
      expectedAmount: null,
      invoiceNumber: null,
      purpose: null,
      requestedExecutionDate: null,
      sourceAmount: null,
      sourceCurrencyCode: null,
      sourceCurrencyId: null,
      targetCurrencyCode: null,
      targetCurrencyId: null,
    },
    nextAction: "submit",
    quoteSummary: null,
    requiredActions: [],
    submissionCompleteness: {
      blockingReasons: [],
      complete: true,
    },
    summary: {
      applicantDisplayName: "ACME LLC",
      createdAt: now,
      id: IDS.deal,
      status: "draft",
      type: "payment",
    },
    timeline: [],
  };
}

function createPortalDealListItem() {
  return {
    applicantDisplayName: "ACME LLC",
    attachmentCount: 0,
    calculationSummary: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    id: IDS.deal,
    nextAction: "submit",
    quoteExpiresAt: null,
    status: "draft",
    submissionComplete: true,
    type: "payment",
  };
}

function createPortalDealDetail() {
  return {
    calculation: null,
    deal: {
      customerId: IDS.customer,
      id: IDS.deal,
      type: "payment",
    },
    organizationName: "ACME LLC",
  };
}

function createTestApp() {
  let currentProjection = createPortalProjection();
  const dealProjectionsWorkflow = {
    getPortalDealProjection: vi.fn(async () => currentProjection),
    listPortalDeals: vi.fn(async () => ({
      data: [createPortalDealListItem()],
      limit: 200,
      offset: 0,
      total: 1,
    })),
  };
  const filesModule = {
    files: {
      commands: {
        deleteDealAttachment: vi.fn(async () => undefined),
        uploadDealAttachment: vi.fn(async () => {
          currentProjection = createPortalProjection({
            attachmentId: IDS.attachment,
          });

          return {
            createdAt: "2026-04-01T00:00:00.000Z",
            fileName: "invoice.pdf",
            id: IDS.attachment,
            purpose: "invoice",
          };
        }),
      },
      queries: {
        getDealAttachmentDownloadUrl: vi.fn(
          async () => "https://example.com/attachment.pdf",
        ),
      },
    },
  };
  const dealsModule = {
    deals: {
      commands: {
        appendTimelineEvent: vi.fn(async () => undefined),
      },
    },
  };
  const agreementsModule = {
    agreements: {
      queries: {
        findById: vi.fn(async () => createAgreementDetail()),
        list: vi.fn(async () => ({
          data: [{ id: IDS.agreement }],
          total: 1,
          limit: 2,
          offset: 0,
        })),
      },
    },
  };
  const partiesModule = {
    counterparties: {},
    customers: {},
    requisites: {},
  };
  const dealAttachmentIngestionWorkflow = {
    enqueueIfEligible: vi.fn(async () => undefined),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: IDS.user } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    } as any);
    await next();
  });

  app.route(
    "/v1/portal",
    portalRoutes({
      agreementsModule,
      calculationsModule: {},
      currenciesService: {},
      customerMembershipsService: {},
      dealAttachmentIngestionWorkflow,
      dealProjectionsWorkflow,
      dealsModule,
      filesModule,
      iamService: {},
      logger: {
        warn: vi.fn(),
      },
      partiesModule,
      portalService,
      portalAccessGrantsService: {},
    } as any),
  );

  return {
    app,
    portalService,
    dealAttachmentIngestionWorkflow,
    dealProjectionsWorkflow,
    dealsModule,
    filesModule,
  };
}

describe("portal routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves the portal profile and leaves the legacy customer profile path unmounted", async () => {
    const { app, portalService } = createTestApp();

    const profileResponse = await app.request(
      "http://localhost/v1/portal/profile",
    );
    const legacyResponse = await app.request(
      "http://localhost/v1/customer/profile",
    );

    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toEqual(createPortalProfile());
    expect(portalService.assertOnboardingAccess).toHaveBeenCalledWith({
      userId: IDS.user,
    });
    expect(legacyResponse.status).toBe(404);
  });

  it("lists portal customers on the new customers path", async () => {
    const { app } = createTestApp();

    const response = await app.request("http://localhost/v1/portal/customers");
    const legacyResponse = await app.request(
      "http://localhost/v1/customer/contexts",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          agentAgreement: {
            contractNumber: "AG-2026-001",
            status: "active",
          },
          customer: {
            createdAt: "2026-04-01T00:00:00.000Z",
            description: null,
            externalRef: "ACME-001",
            id: IDS.customer,
            name: "ACME LLC",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          counterparties: [],
        },
      ],
      total: 1,
    });
    expect(legacyResponse.status).toBe(404);
  });

  it("creates portal deal drafts with idempotency", async () => {
    const { app, portalService } = createTestApp();

    const response = await app.request(
      "http://localhost/v1/portal/deals/drafts",
      {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem-portal-1",
      },
      body: JSON.stringify({
        common: {
          applicantCounterpartyId: IDS.customer,
          customerNote: null,
          requestedExecutionDate: null,
        },
        moneyRequest: {
          purpose: "Invoice payment",
          sourceAmount: "1000",
          sourceCurrencyId: "USD",
          targetCurrencyId: "RUB",
        },
        type: "payment",
      }),
      },
    );

    expect(response.status).toBe(201);
    expect(portalService.createDealDraft).toHaveBeenCalledWith(
      { userId: IDS.user },
      expect.objectContaining({
        type: "payment",
      }),
      { idempotencyKey: "idem-portal-1" },
    );
  });

  it("serves portal-safe projection reads", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();

    const listResponse = await app.request(
      "http://localhost/v1/portal/deals/projections?limit=10&offset=0",
    );
    const getResponse = await app.request(
      `http://localhost/v1/portal/deals/${IDS.deal}/projection`,
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      data: [
        {
          ...createPortalDealListItem(),
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      limit: 10,
      offset: 0,
      total: 1,
    });
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual(createPortalProjection());
    expect(dealProjectionsWorkflow.listPortalDeals).toHaveBeenCalledWith(
      IDS.customer,
      200,
      0,
    );
  });

  it("authorizes portal attachment list, upload, download, and delete flows", async () => {
    const {
      app,
      dealAttachmentIngestionWorkflow,
      dealsModule,
      filesModule,
    } = createTestApp();
    const uploadForm = new FormData();

    uploadForm.set(
      "file",
      new File([Buffer.from("attachment")], "invoice.pdf", {
        type: "application/pdf",
      }),
    );
    uploadForm.set("purpose", "invoice");

    const listBeforeResponse = await app.request(
      `http://localhost/v1/portal/deals/${IDS.deal}/attachments`,
    );
    const uploadResponse = await app.request(
      `http://localhost/v1/portal/deals/${IDS.deal}/attachments`,
      {
        method: "POST",
        body: uploadForm,
      },
    );
    const downloadResponse = await app.request(
      `http://localhost/v1/portal/deals/${IDS.deal}/attachments/${IDS.attachment}/download`,
    );
    const deleteResponse = await app.request(
      `http://localhost/v1/portal/deals/${IDS.deal}/attachments/${IDS.attachment}`,
      {
        method: "DELETE",
      },
    );

    expect(listBeforeResponse.status).toBe(200);
    await expect(listBeforeResponse.json()).resolves.toEqual([]);
    expect(uploadResponse.status).toBe(201);
    await expect(uploadResponse.json()).resolves.toEqual({
      createdAt: "2026-04-01T00:00:00.000Z",
      fileName: "invoice.pdf",
      id: IDS.attachment,
      ingestionStatus: "processing",
      purpose: "invoice",
    });
    expect(filesModule.files.commands.uploadDealAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: IDS.deal,
        uploadedBy: IDS.user,
      }),
    );
    expect(dealAttachmentIngestionWorkflow.enqueueIfEligible).toHaveBeenCalledWith(
      {
        dealId: IDS.deal,
        fileAssetId: IDS.attachment,
      },
    );
    expect(downloadResponse.status).toBe(302);
    expect(downloadResponse.headers.get("location")).toBe(
      "https://example.com/attachment.pdf",
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true });
    expect(filesModule.files.commands.deleteDealAttachment).toHaveBeenCalledWith(
      {
        fileAssetId: IDS.attachment,
        ownerId: IDS.deal,
      },
    );
    expect(dealsModule.deals.commands.appendTimelineEvent).toHaveBeenCalledTimes(
      2,
    );
  });
});

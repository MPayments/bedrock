import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { documentsRoutes } from "../../src/routes/documents";

function createDocumentWithOperation() {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    document: {
      id: "11111111-1111-4111-8111-111111111111",
      docType: "transfer_intra",
      docNo: "DOC-1",
      payloadVersion: 1,
      payload: { amountMinor: "1234", currency: "USD" },
      title: "Document",
      occurredAt: now,
      submissionStatus: "submitted",
      approvalStatus: "approved",
      postingStatus: "posted",
      lifecycleStatus: "active",
      createIdempotencyKey: "create-idem",
      amountMinor: 1234n,
      currency: "USD",
      memo: null,
      counterpartyId: null,
      customerId: null,
      organizationRequisiteId: null,
      searchText: "",
      createdBy: "user-1",
      submittedBy: "user-1",
      submittedAt: now,
      approvedBy: "user-1",
      approvedAt: now,
      rejectedBy: null,
      rejectedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      postingStartedAt: now,
      postedAt: now,
      postingError: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      moduleId: "documents.core",
      moduleVersion: "1.0.0",
    },
    postingOperationId: null,
    allowedActions: ["submit", "approve", "reject", "post", "cancel", "repost"],
  };
}

function createDocumentWithOperationFor(docType: string) {
  return {
    ...createDocumentWithOperation(),
    document: {
      ...createDocumentWithOperation().document,
      docType,
    },
  };
}

function createDocumentDetails() {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const base = createDocumentWithOperation();

  return {
    document: base.document,
    postingOperationId: "11111111-1111-4111-8111-111111111112",
    allowedActions: base.allowedActions,
    links: [],
    parent: null,
    children: [],
    dependsOn: [],
    compensates: [],
    documentOperations: [
      {
        id: "11111111-1111-4111-8111-111111111113",
        documentId: base.document.id,
        operationId: "11111111-1111-4111-8111-111111111112",
        kind: "post",
        createdAt: now,
      },
    ],
    events: [],
    snapshot: null,
    ledgerOperations: [],
    computed: {
      allocatedAmountMinor: "0",
      settledAmountMinor: "0",
      availableAmountMinor: "1234",
      allocatedAmount: "0",
      settledAmount: "0",
      availableAmount: "12.34",
      timeline: [],
    },
    extra: null,
  };
}

function createDocumentsModuleStub() {
  return {
    documents: {
      commands: {
        updateDraft: vi.fn(),
      },
      queries: {
        list: vi.fn(),
        get: vi.fn(),
        getDetails: vi.fn(),
      },
    },
    lifecycle: {
      commands: {
        execute: vi.fn(),
      },
    },
  };
}

function createAccountingModuleStub() {
  return {
    reports: {
      queries: {
        getOperationDetailsWithLabels: vi.fn(),
        listOperationDetailsWithLabels: vi.fn(),
        listOperationsWithLabels: vi.fn(),
      },
    },
  };
}

function createDocumentDraftWorkflowStub() {
  return {
    createDraft: vi.fn(),
  };
}

function createDocumentPostingWorkflowStub() {
  return {
    post: vi.fn(),
    repost: vi.fn(),
  };
}

function createTestApp(input?: {
  requestIdempotencyKey?: string | null;
  role?: string;
}) {
  const requestIdempotencyKey =
    input && "requestIdempotencyKey" in input
      ? input.requestIdempotencyKey
      : "idem-1";
  const role = input?.role ?? "admin";
  const documentsModule = createDocumentsModuleStub();
  const accountingModule = createAccountingModuleStub();
  const documentDraftWorkflow = createDocumentDraftWorkflowStub();
  const documentPostingWorkflow = createDocumentPostingWorkflowStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: requestIdempotencyKey,
    } as any);
    await next();
  });
  app.route(
    "/",
    documentsRoutes({
      accountingModule,
      documentsModule,
      documentDraftWorkflow,
      documentPostingWorkflow,
    } as any),
  );

  return {
    app,
    accountingModule,
    documentsModule,
    documentDraftWorkflow,
    documentPostingWorkflow,
  };
}

describe("documentsRoutes mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for all mutation actions when idempotency header is missing", async () => {
    const { app, documentsModule } = createTestApp({
      requestIdempotencyKey: null,
    });
    const documentId = "22222222-2222-4222-8222-222222222222";
    const actions = ["submit", "approve", "reject", "post", "cancel", "repost"] as const;

    for (const action of actions) {
      const response = await app.request(
        `http://localhost/transfer_intra/${documentId}/${action}`,
        { method: "POST" },
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Missing Idempotency-Key header",
      });
    }

    expect(documentsModule.lifecycle.commands.execute).not.toHaveBeenCalled();
  });

  it("routes each mutation action to corresponding documents service call", async () => {
    const { app, documentsModule, documentPostingWorkflow } = createTestApp();
    const documentId = "33333333-3333-4333-8333-333333333333";
    const expectedResult = createDocumentWithOperation();
    const actions = ["submit", "approve", "reject", "post", "cancel", "repost"] as const;

    for (const action of actions) {
      if (action === "post") {
        documentPostingWorkflow.post.mockResolvedValueOnce(expectedResult);
      } else if (action === "repost") {
        documentPostingWorkflow.repost.mockResolvedValueOnce(expectedResult);
      } else {
        documentsModule.lifecycle.commands.execute.mockResolvedValueOnce(
          expectedResult,
        );
      }

      const response = await app.request(
        `http://localhost/transfer_intra/${documentId}/${action}`,
        { method: "POST" },
      );

      expect(response.status).toBe(200);
      const expectedInput = {
        docType: "transfer_intra",
        documentId,
        actorUserId: "user-1",
        idempotencyKey: "idem-1",
        requestContext: expect.objectContaining({
          requestId: "req-1",
          correlationId: "corr-1",
        }),
      };

      if (action === "post") {
        expect(documentPostingWorkflow.post).toHaveBeenCalledWith(expectedInput);
      } else if (action === "repost") {
        expect(documentPostingWorkflow.repost).toHaveBeenCalledWith(expectedInput);
      } else {
        expect(documentsModule.lifecycle.commands.execute).toHaveBeenCalledWith({
          action,
          ...expectedInput,
        });
      }
    }
  });

  it("filters allowed actions on list responses using public permissions", async () => {
    userHasPermission.mockImplementation(async ({ body }) => {
      const permission = body.permissions.documents?.[0];
      return {
        success:
          permission === "list" ||
          permission === "get" ||
          permission === "submit" ||
          permission === "cancel",
      };
    });

    const { app, documentsModule } = createTestApp();
    documentsModule.documents.queries.list.mockResolvedValue({
      data: [createDocumentWithOperation()],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
          allowedActions: ["submit", "cancel"],
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(documentsModule.documents.queries.list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
      }),
      "user-1",
    );
  });

  it("blocks system-only document creation for non-admin users", async () => {
    const { app, documentDraftWorkflow } = createTestApp({ role: "operator" });

    const response = await app.request("http://localhost/period_close", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        createIdempotencyKey: "create-idem",
        input: {
          occurredAt: "2026-03-01T00:00:00.000Z",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'Document type "period_close" is system-only and cannot be mutated via public API',
    });
    expect(documentDraftWorkflow.createDraft).not.toHaveBeenCalled();
  });

  it("allows admins to create public period_reopen documents", async () => {
    const { app, documentDraftWorkflow } = createTestApp({ role: "admin" });
    documentDraftWorkflow.createDraft.mockResolvedValue(
      createDocumentWithOperationFor("period_reopen"),
    );

    const response = await app.request("http://localhost/period_reopen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        createIdempotencyKey: "create-idem",
        input: {
          occurredAt: "2026-03-01T00:00:00.000Z",
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(documentDraftWorkflow.createDraft).toHaveBeenCalledWith({
      docType: "period_reopen",
      createIdempotencyKey: "create-idem",
      payload: {
        occurredAt: "2026-03-01T00:00:00.000Z",
      },
      actorUserId: "user-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
  });

  it("blocks public creation for system-only fx_resolution documents", async () => {
    const { app, documentDraftWorkflow } = createTestApp({ role: "admin" });

    const response = await app.request("http://localhost/fx_resolution", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        createIdempotencyKey: "create-idem",
        input: {
          occurredAt: "2026-03-01T00:00:00.000Z",
          fxExecuteDocumentId: "11111111-1111-4111-8111-111111111111",
          resolutionType: "settle",
          eventIdempotencyKey: "evt-1",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'Document type "fx_resolution" is system-only and cannot be mutated via public API',
    });
    expect(documentDraftWorkflow.createDraft).not.toHaveBeenCalled();
  });

  it("allows admins to approve period_close documents", async () => {
    const { app, documentsModule } = createTestApp({ role: "admin" });
    documentsModule.lifecycle.commands.execute.mockResolvedValue(
      createDocumentWithOperationFor("period_close"),
    );

    const response = await app.request(
      "http://localhost/period_close/11111111-1111-4111-8111-111111111111/approve",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(documentsModule.lifecycle.commands.execute).toHaveBeenCalledWith({
      action: "approve",
      docType: "period_close",
      documentId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "user-1",
      idempotencyKey: "idem-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
  });

  it("allows admins to submit period_reopen documents", async () => {
    const { app, documentsModule } = createTestApp({ role: "admin" });
    documentsModule.lifecycle.commands.execute.mockResolvedValue(
      createDocumentWithOperationFor("period_reopen"),
    );

    const response = await app.request(
      "http://localhost/period_reopen/11111111-1111-4111-8111-111111111111/submit",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(documentsModule.lifecycle.commands.execute).toHaveBeenCalledWith({
      action: "submit",
      docType: "period_reopen",
      documentId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "user-1",
      idempotencyKey: "idem-1",
      requestContext: expect.objectContaining({
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
  });

  it("returns document details with labeled ledger operations", async () => {
    const { accountingModule, app, documentsModule } = createTestApp();
    const details = createDocumentDetails();
    documentsModule.documents.queries.getDetails.mockResolvedValue(details);
    accountingModule.reports.queries.listOperationDetailsWithLabels.mockResolvedValue(
      new Map([
        [
          "11111111-1111-4111-8111-111111111112",
          {
            operation: {
              id: "11111111-1111-4111-8111-111111111112",
              sourceType: "documents/transfer_intra/post",
              sourceId: details.document.id,
              operationCode: "TRANSFER_INTRA_POST",
              operationVersion: 1,
              postingDate: new Date("2026-01-01T00:00:00.000Z"),
              status: "posted",
              error: null,
              postedAt: new Date("2026-01-01T00:00:01.000Z"),
              outboxAttempts: 0,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              postingCount: 1,
              bookIds: ["book-1"],
              currencies: ["USD"],
              bookLabels: {},
            },
            postings: [
              {
                id: "posting-1",
                lineNo: 1,
                bookId: "book-1",
                bookName: "Main book",
                debitInstanceId: "debit-1",
                debitAccountNo: "1010",
                debitDimensions: null,
                creditInstanceId: "credit-1",
                creditAccountNo: "2010",
                creditDimensions: null,
                postingCode: "TR.1001",
                currency: "USD",
                currencyPrecision: 2,
                amountMinor: 1234n,
                memo: null,
                context: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
            tbPlans: [],
            dimensionLabels: {},
          },
        ],
      ]),
    );

    const response = await app.request(
      `http://localhost/${details.document.docType}/${details.document.id}/details`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        document: expect.objectContaining({
          id: details.document.id,
        }),
        ledgerOperations: [
          expect.objectContaining({
            operation: expect.objectContaining({
              id: "11111111-1111-4111-8111-111111111112",
            }),
          }),
        ],
      }),
    );
    expect(
      accountingModule.reports.queries.listOperationDetailsWithLabels,
    ).toHaveBeenCalledWith(["11111111-1111-4111-8111-111111111112"]);
  });

  it("sanitizes invalid journal query params instead of returning 400", async () => {
    const { accountingModule, app } = createTestApp();
    accountingModule.reports.queries.listOperationsWithLabels.mockResolvedValue({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const response = await app.request(
      "http://localhost/journal?limit=oops&offset=-1&sortBy=bogus&sortOrder=sideways&query=%20%20&status=wat&status=posted&operationCode=%20%20&operationCode=PAYMENT_ORDER&sourceType=&sourceType=documents&sourceId=%20%20&bookId=%20%20&dimension.customer=&dimension.customer=customer-1&dimension.%20%20=value",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(
      accountingModule.reports.queries.listOperationsWithLabels,
    ).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
      status: ["posted"],
      operationCode: ["PAYMENT_ORDER"],
      sourceType: ["documents"],
      dimensionFilters: {
        customer: ["customer-1"],
      },
    });
  });
});

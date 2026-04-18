import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListLedgerOperationsInputSchema } from "@bedrock/ledger/contracts";

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

function createDocumentsServiceStub() {
  return {
    createDraft: vi.fn(),
    list: vi.fn(),
    updateDraft: vi.fn(),
    get: vi.fn(),
    getDetails: vi.fn(),
    actions: {
      execute: vi.fn(),
    },
  };
}

function createDocumentPostingWorkflowStub() {
  return {
    post: vi.fn(),
    repost: vi.fn(),
  };
}

function createAccountingReportsServiceStub() {
  return {
    listOperationsWithLabels: vi.fn(),
    getOperationDetailsWithLabels: vi.fn(),
    listOperationDetailsWithLabels: vi.fn(),
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
  const documentsService = createDocumentsServiceStub();
  const documentPostingWorkflow = createDocumentPostingWorkflowStub();
  const accountingReportsService = createAccountingReportsServiceStub();
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
      accountingModule: {
        reports: {
          queries: {
            getOperationDetailsWithLabels:
              accountingReportsService.getOperationDetailsWithLabels,
            listOperationDetailsWithLabels:
              accountingReportsService.listOperationDetailsWithLabels,
            listOperationsWithLabels:
              accountingReportsService.listOperationsWithLabels,
          },
        },
      },
      accountingReportsService,
      documentsService,
      documentPostingWorkflow,
    } as any),
  );

  return {
    app,
    accountingReportsService,
    documentsService,
    documentPostingWorkflow,
  };
}

describe("documentsRoutes mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for all mutation actions when idempotency header is missing", async () => {
    const { app, documentsService } = createTestApp({
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

    expect(documentsService.actions.execute).not.toHaveBeenCalled();
  });

  it("routes each mutation action to corresponding documents service call", async () => {
    const { app, documentsService, documentPostingWorkflow } = createTestApp();
    const documentId = "33333333-3333-4333-8333-333333333333";
    const expectedResult = createDocumentWithOperation();
    const actions = ["submit", "approve", "reject", "post", "cancel", "repost"] as const;

    for (const action of actions) {
      if (action === "post") {
        documentPostingWorkflow.post.mockResolvedValueOnce(expectedResult);
      } else if (action === "repost") {
        documentPostingWorkflow.repost.mockResolvedValueOnce(expectedResult);
      } else {
        documentsService.actions.execute.mockResolvedValueOnce(expectedResult);
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
        expect(documentsService.actions.execute).toHaveBeenCalledWith({
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

    const { app, documentsService } = createTestApp();
    documentsService.list.mockResolvedValue({
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
    expect(documentsService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
      }),
      "user-1",
    );
  });

  it("keeps post and cancel actions visible for finance users", async () => {
    userHasPermission.mockImplementation(async ({ body }) => {
      const permission = body.permissions.documents?.[0];
      return {
        success:
          permission === "list" ||
          permission === "get" ||
          permission === "submit" ||
          permission === "post" ||
          permission === "cancel",
      };
    });

    const { app, documentsService } = createTestApp({ role: "finance" });
    documentsService.list.mockResolvedValue({
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
          allowedActions: ["submit", "post", "cancel", "repost"],
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it("omits absent optional filters when listing journal operations", async () => {
    const { app, accountingReportsService } = createTestApp();
    accountingReportsService.listOperationsWithLabels.mockResolvedValue({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const response = await app.request("http://localhost/journal");

    expect(response.status).toBe(200);
    expect(() =>
      ListLedgerOperationsInputSchema.parse(
        accountingReportsService.listOperationsWithLabels.mock.calls[0]?.[0],
      ),
    ).not.toThrow();
    expect(accountingReportsService.listOperationsWithLabels).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("accepts dimension filters without explicit undefined optional fields", async () => {
    const { app, accountingReportsService } = createTestApp();
    accountingReportsService.listOperationsWithLabels.mockResolvedValue({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const response = await app.request(
      "http://localhost/journal?dimension.counterpartyId=counterparty-1",
    );

    expect(response.status).toBe(200);
    expect(() =>
      ListLedgerOperationsInputSchema.parse(
        accountingReportsService.listOperationsWithLabels.mock.calls[0]?.[0],
      ),
    ).not.toThrow();
    expect(accountingReportsService.listOperationsWithLabels).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
      dimensionFilters: {
        counterpartyId: ["counterparty-1"],
      },
    });
  });

  it("blocks system-only document creation for non-admin users", async () => {
    const { app, documentsService } = createTestApp({ role: "operator" });

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
    expect(documentsService.createDraft).not.toHaveBeenCalled();
  });

  it("allows admins to create public period_reopen documents", async () => {
    const { app, documentsService } = createTestApp({ role: "admin" });
    documentsService.createDraft.mockResolvedValue(
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
    expect(documentsService.createDraft).toHaveBeenCalledWith({
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
    const { app, documentsService } = createTestApp({ role: "admin" });

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
    expect(documentsService.createDraft).not.toHaveBeenCalled();
  });

  it("allows admins to approve period_close documents", async () => {
    const { app, documentsService } = createTestApp({ role: "admin" });
    documentsService.actions.execute.mockResolvedValue(
      createDocumentWithOperationFor("period_close"),
    );

    const response = await app.request(
      "http://localhost/period_close/11111111-1111-4111-8111-111111111111/approve",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(documentsService.actions.execute).toHaveBeenCalledWith({
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
    const { app, documentsService } = createTestApp({ role: "admin" });
    documentsService.actions.execute.mockResolvedValue(
      createDocumentWithOperationFor("period_reopen"),
    );

    const response = await app.request(
      "http://localhost/period_reopen/11111111-1111-4111-8111-111111111111/submit",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(documentsService.actions.execute).toHaveBeenCalledWith({
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
});

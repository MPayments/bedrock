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
      counterpartyAccountId: null,
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

function createDocumentsServiceStub() {
  return {
    list: vi.fn(),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    get: vi.fn(),
    getDetails: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    post: vi.fn(),
    cancel: vi.fn(),
    repost: vi.fn(),
  };
}

function createTestApp(requestIdempotencyKey: string | null = "idem-1") {
  const documentsService = createDocumentsServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: requestIdempotencyKey,
    } as any);
    await next();
  });
  app.route("/", documentsRoutes({ documentsService } as any));

  return { app, documentsService };
}

describe("documentsRoutes mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for all mutation actions when idempotency header is missing", async () => {
    const { app, documentsService } = createTestApp(null);
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

    expect(documentsService.submit).not.toHaveBeenCalled();
    expect(documentsService.approve).not.toHaveBeenCalled();
    expect(documentsService.reject).not.toHaveBeenCalled();
    expect(documentsService.post).not.toHaveBeenCalled();
    expect(documentsService.cancel).not.toHaveBeenCalled();
    expect(documentsService.repost).not.toHaveBeenCalled();
  });

  it("routes each mutation action to corresponding documents service call", async () => {
    const { app, documentsService } = createTestApp("idem-1");
    const documentId = "33333333-3333-4333-8333-333333333333";
    const expectedResult = createDocumentWithOperation();
    const actionToMethod = {
      submit: "submit",
      approve: "approve",
      reject: "reject",
      post: "post",
      cancel: "cancel",
      repost: "repost",
    } as const;

    for (const [action, method] of Object.entries(actionToMethod)) {
      const serviceMock = documentsService[method];
      serviceMock.mockResolvedValueOnce(expectedResult);

      const response = await app.request(
        `http://localhost/transfer_intra/${documentId}/${action}`,
        { method: "POST" },
      );

      expect(response.status).toBe(200);
      expect(serviceMock).toHaveBeenCalledWith({
        docType: "transfer_intra",
        documentId,
        actorUserId: "user-1",
        idempotencyKey: "idem-1",
        requestContext: expect.objectContaining({
          requestId: "req-1",
          correlationId: "corr-1",
        }),
      });
    }
  });
});

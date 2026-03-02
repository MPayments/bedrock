import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createStubDb } from "@bedrock/test-utils";

import {
  CreateDocumentInputSchema,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentRegistryError,
  DocumentValidationError,
  createDefaultDocumentActionPolicyService,
  createDocumentRegistry,
  createDocumentsService,
  validateInput,
} from "../../src/documents";
import { createDocumentsServiceContext } from "../../src/documents/internal/context";
import type { DocumentModule } from "../../src/documents/types";

function createModuleStub(): DocumentModule<{ memo: string }, { memo: string }> {
  const payloadSchema = z.object({ memo: z.string() });

  return {
    docType: "test.document",
    docNoPrefix: "TST",
    payloadVersion: 1,
    createSchema: payloadSchema,
    updateSchema: payloadSchema,
    payloadSchema,
    postingRequired: false,
    approvalRequired: () => false,
    async createDraft() {
      return {
        occurredAt: new Date("2026-03-01T00:00:00.000Z"),
        payload: { memo: "draft" },
      };
    },
    async updateDraft() {
      return {
        payload: { memo: "updated" },
      };
    },
    deriveSummary() {
      return {
        title: "Test",
        searchText: "Test document",
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    buildPostIdempotencyKey() {
      return "post-idem";
    },
  };
}

function createServiceDeps() {
  const registry = createDocumentRegistry([createModuleStub()]);

  return {
    accounting: {
      resolvePostingPlan: vi.fn(),
    },
    db: createStubDb(),
    ledger: {
      commit: vi.fn(),
    },
    ledgerReadService: {
      getOperationDetails: vi.fn(),
    },
    registry,
  } as any;
}

describe("documents foundations", () => {
  it("creates a registry and resolves registered modules", () => {
    const module = createModuleStub();
    const registry = createDocumentRegistry([module]);

    expect(registry.getDocumentModules()).toEqual([module]);
    expect(registry.getDocumentModule(module.docType)).toBe(module);
    expect(() => registry.getDocumentModule("missing")).toThrow(
      "Unknown document module: missing",
    );
  });

  it("constructs document error types with current messages and metadata", () => {
    const postingError = new DocumentPostingNotRequiredError("doc-1", "test.doc");
    expect(postingError.message).toContain("does not support posting");

    const policyError = new DocumentPolicyDeniedError("approve", "blocked", {
      scope: "maker-checker",
    });
    expect(policyError.action).toBe("approve");
    expect(policyError.reasonCode).toBe("blocked");
    expect(policyError.reasonMeta).toEqual({ scope: "maker-checker" });

    const registryError = new DocumentRegistryError("registry failure");
    expect(registryError.message).toBe("registry failure");
  });

  it("validates input and rewrites zod errors into document validation errors", () => {
    const schema = z.object({
      nested: z.object({
        value: z.string().min(2),
      }),
    });

    expect(
      validateInput(schema, {
        nested: { value: "ok" },
      }),
    ).toEqual({
      nested: { value: "ok" },
    });

    expect(() =>
      validateInput(
        schema,
        {
          nested: { value: "x" },
        },
        "test.create",
      ),
    ).toThrow(DocumentValidationError);

    expect(() =>
      validateInput(
        schema,
        {
          nested: { value: "x" },
        },
        "test.create",
      ),
    ).toThrow("test.create: nested.value:");
  });

  it("exports the current create schema contract", () => {
    expect(
      CreateDocumentInputSchema.parse({
        createIdempotencyKey: "idem-1",
        input: { ok: true },
      }),
    ).toEqual({
      createIdempotencyKey: "idem-1",
      input: { ok: true },
    });
  });

  it("uses the current default document policy behavior", async () => {
    const service = createDefaultDocumentActionPolicyService();
    const module = createModuleStub();
    const document = {
      id: "doc-1",
      createdBy: "maker-1",
    } as any;

    await expect(
      service.canCreate({
        module,
        actorUserId: "user-1",
        payload: { memo: "draft" },
        moduleContext: {} as any,
      }),
    ).resolves.toEqual({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    });

    await expect(
      service.canApprove({
        module,
        document,
        actorUserId: "checker-1",
        moduleContext: {} as any,
      }),
    ).resolves.toEqual({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    });
  });

  it("builds the documents service context with injected logger and policy", () => {
    const loggerChild = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => loggerChild),
    };
    const customPolicy = {
      approvalMode: vi.fn(),
      canCreate: vi.fn(),
      canEdit: vi.fn(),
      canSubmit: vi.fn(),
      canApprove: vi.fn(),
      canReject: vi.fn(),
      canPost: vi.fn(),
      canCancel: vi.fn(),
    };

    const context = createDocumentsServiceContext({
      ...createServiceDeps(),
      logger,
      policy: customPolicy,
    } as any);

    expect(logger.child).toHaveBeenCalledWith({ svc: "documents" });
    expect(context.log).toBe(loggerChild);
    expect(context.policy).toBe(customPolicy);
  });

  it("creates the documents service facade with the current handler surface", () => {
    const service = createDocumentsService(createServiceDeps());

    expect(service).toEqual({
      createDraft: expect.any(Function),
      updateDraft: expect.any(Function),
      submit: expect.any(Function),
      approve: expect.any(Function),
      reject: expect.any(Function),
      post: expect.any(Function),
      repost: expect.any(Function),
      cancel: expect.any(Function),
      list: expect.any(Function),
      get: expect.any(Function),
      getDetails: expect.any(Function),
      validateAccountingSourceCoverage: expect.any(Function),
    });
  });
});

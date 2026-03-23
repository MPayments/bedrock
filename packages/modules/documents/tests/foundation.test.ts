import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentRegistryError,
  DocumentValidationError,
  createDefaultDocumentActionPolicyService,
  createDocumentsModule,
} from "../src";
import {
  createDocumentsPublicServiceDeps,
  createTestDocumentRegistry,
  createTestDocumentModule,
} from "./helpers";
import { CreateDocumentInputSchema } from "../src/contracts";
import { validateInput } from "../src/documents/application/validation";
import type { DocumentModule } from "../src/plugins";

function createModuleStub(): DocumentModule<{ memo: string }, { memo: string }> {
  const payloadSchema = z.object({ memo: z.string() });

  return createTestDocumentModule({
    docType: "test.document",
    createSchema: payloadSchema,
    updateSchema: payloadSchema,
    payloadSchema,
    postingRequired: false,
  }) as DocumentModule<{ memo: string }, { memo: string }>;
}

describe("documents foundations", () => {
  it("creates a registry and resolves registered modules", () => {
    const module = createModuleStub();
    const registry = createTestDocumentRegistry([module]);

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

  it("creates namespaced runtimes for the documents module services", () => {
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

    createDocumentsModule({
      ...createDocumentsPublicServiceDeps([createModuleStub()]),
      logger,
      policy: customPolicy,
    });

    expect(logger.child).toHaveBeenCalledWith({
      service: "documents.documents",
    });
    expect(logger.child).toHaveBeenCalledWith({
      service: "documents.lifecycle",
    });
    expect(logger.child).toHaveBeenCalledWith({
      service: "documents.posting",
    });
    expect(loggerChild).toBeDefined();
    expect(customPolicy).toBeDefined();
  });

  it("creates the documents module facade with the current handler surface", () => {
    const module = createDocumentsModule(
      createDocumentsPublicServiceDeps([createModuleStub()]),
    );

    expect(module).toEqual({
      documents: {
        commands: {
          createDraft: expect.any(Function),
          updateDraft: expect.any(Function),
        },
        queries: {
          list: expect.any(Function),
          get: expect.any(Function),
          getDetails: expect.any(Function),
        },
      },
      lifecycle: {
        commands: {
          execute: expect.any(Function),
        },
      },
      posting: {
        commands: {
          resolveIdempotencyKey: expect.any(Function),
          preparePost: expect.any(Function),
          prepareRepost: expect.any(Function),
          finalizeSuccess: expect.any(Function),
          finalizeFailure: expect.any(Function),
          validateAccountingSourceCoverage: expect.any(Function),
        },
      },
    });
  });
});

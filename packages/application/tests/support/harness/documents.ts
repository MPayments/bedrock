import { vi } from "vitest";

import { createStubDb } from "@bedrock/test-utils";

import { createDocumentRegistry } from "../../../src/documents";
import type {
  DocumentActionPolicyService,
  DocumentModule,
} from "../../../src/documents/types";
import { createTestDocumentModule } from "../builders/documents";

export function createDocumentPolicyStub(): DocumentActionPolicyService {
  return {
    approvalMode: vi.fn(async () => "not_required"),
    canCreate: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canEdit: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canSubmit: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canApprove: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canReject: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canPost: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canCancel: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
  };
}

export function createDocumentsServiceDeps(
  modules: DocumentModule[] = [createTestDocumentModule()],
) {
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
    registry: createDocumentRegistry(modules),
  } as any;
}

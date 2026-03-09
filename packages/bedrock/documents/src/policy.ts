import type { Document } from "@bedrock/documents/schema";

import type {
  DocumentActionPolicyService,
  DocumentApprovalMode,
  DocumentModule,
  DocumentModuleContext,
  DocumentPolicyDecision,
} from "./types";

function allow(reasonCode = "allowed"): DocumentPolicyDecision {
  return {
    allow: true,
    reasonCode,
    reasonMeta: null,
  };
}

function makerCheckerDenied(document: Document, actorUserId: string) {
  return {
    allow: false,
    reasonCode: "maker_checker_denied",
    reasonMeta: {
      documentId: document.id,
      createdBy: document.createdBy,
      actorUserId,
    },
  } satisfies DocumentPolicyDecision;
}

export function createDefaultDocumentActionPolicyService(): DocumentActionPolicyService {
  async function approvalMode(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentApprovalMode> {
    return input.module.approvalRequired(input.document)
      ? "maker_checker"
      : "not_required";
  }

  return {
    approvalMode,
    async canCreate() {
      return allow();
    },
    async canEdit() {
      return allow();
    },
    async canSubmit() {
      return allow();
    },
    async canApprove(input) {
      const mode = await approvalMode(input);
      if (
        mode === "maker_checker" &&
        input.document.createdBy === input.actorUserId
      ) {
        return makerCheckerDenied(input.document, input.actorUserId);
      }

      return allow();
    },
    async canReject() {
      return allow();
    },
    async canPost() {
      return allow();
    },
    async canCancel() {
      return allow();
    },
  };
}

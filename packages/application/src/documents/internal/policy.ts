import type { Document } from "@bedrock/application/documents/schema";
import type { Database, Transaction } from "@bedrock/common/db/types";

import { DocumentPolicyDeniedError } from "../errors";
import { buildDocumentEventState, insertDocumentEvent } from "./helpers";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentModuleContext,
  DocumentRequestContext,
} from "../types";

interface EnforceDocumentPolicyInput {
  policy: DocumentActionPolicyService;
  action:
    | "create"
    | "edit"
    | "submit"
    | "approve"
    | "reject"
    | "post"
    | "cancel";
  module: DocumentModule;
  actorUserId: string;
  moduleContext: DocumentModuleContext;
  payload?: unknown;
  document?: Document;
  requestContext?: DocumentRequestContext;
}

class AuditedDocumentPolicyDeniedError extends DocumentPolicyDeniedError {
  constructor(
    action: string,
    reasonCode: string,
    reasonMeta: Record<string, unknown> | null | undefined,
    public readonly documentId?: string,
    public readonly actorUserId?: string,
    public readonly requestContext?: DocumentRequestContext,
    public readonly beforeState?: Record<string, unknown> | null,
  ) {
    super(action, reasonCode, reasonMeta);
  }
}

export async function enforceDocumentPolicy(
  input: EnforceDocumentPolicyInput,
): Promise<void> {
  const decision =
    input.action === "create"
      ? await input.policy.canCreate({
          module: input.module,
          actorUserId: input.actorUserId,
          payload: input.payload,
          moduleContext: input.moduleContext,
        })
      : input.action === "edit"
        ? await input.policy.canEdit({
            module: input.module,
            document: input.document!,
            actorUserId: input.actorUserId,
            moduleContext: input.moduleContext,
          })
        : input.action === "submit"
          ? await input.policy.canSubmit({
              module: input.module,
              document: input.document!,
              actorUserId: input.actorUserId,
              moduleContext: input.moduleContext,
            })
          : input.action === "approve"
            ? await input.policy.canApprove({
                module: input.module,
                document: input.document!,
                actorUserId: input.actorUserId,
                moduleContext: input.moduleContext,
              })
            : input.action === "reject"
              ? await input.policy.canReject({
                  module: input.module,
                  document: input.document!,
                  actorUserId: input.actorUserId,
                  moduleContext: input.moduleContext,
                })
              : input.action === "post"
                ? await input.policy.canPost({
                    module: input.module,
                    document: input.document!,
                    actorUserId: input.actorUserId,
                    moduleContext: input.moduleContext,
                  })
                : await input.policy.canCancel({
                    module: input.module,
                    document: input.document!,
                    actorUserId: input.actorUserId,
                    moduleContext: input.moduleContext,
                  });

  if (decision.allow) {
    return;
  }

  throw new AuditedDocumentPolicyDeniedError(
    input.action,
    decision.reasonCode,
    decision.reasonMeta,
    input.document?.id,
    input.actorUserId,
    input.requestContext,
    input.document ? buildDocumentEventState(input.document) : null,
  );
}

export async function persistDocumentPolicyDenial(
  db: Database,
  error: unknown,
): Promise<void> {
  if (!(error instanceof AuditedDocumentPolicyDeniedError) || !error.documentId) {
    return;
  }

  await db.transaction(async (tx: Transaction) => {
    await insertDocumentEvent(tx, {
      documentId: error.documentId!,
      eventType: "policy_denied",
      actorId: error.actorUserId ?? null,
      requestId: error.requestContext?.requestId,
      correlationId: error.requestContext?.correlationId,
      traceId: error.requestContext?.traceId,
      causationId: error.requestContext?.causationId,
      reasonCode: error.reasonCode,
      reasonMeta: {
        action: error.action,
        ...(error.reasonMeta ?? {}),
      },
      before: error.beforeState ?? null,
      after: error.beforeState ?? null,
    });
  });
}

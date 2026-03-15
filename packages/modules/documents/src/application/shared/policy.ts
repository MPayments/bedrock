import { resolveDocumentPolicyDecision } from "./action-dispatch";
import type { DocumentRequestContext } from "../../contracts/service";
import type { Document } from "../../domain/document";
import { DocumentPolicyDeniedError } from "../../errors";
import type {
  DocumentActionPolicyService,
  DocumentModule,
  DocumentModuleContext,
} from "../../plugins";
import type { DocumentsTransactionsPort } from "../shared/external-ports";
import { buildDocumentEventState } from "./document-event-state";

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
  const decision = await resolveDocumentPolicyDecision(input);

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
  transactions: DocumentsTransactionsPort,
  error: unknown,
): Promise<void> {
  if (!(error instanceof AuditedDocumentPolicyDeniedError) || !error.documentId) {
    return;
  }

  await transactions.withTransaction(async ({ documentEvents }) => {
    await documentEvents.insertDocumentEvent({
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

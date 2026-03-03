import type { ConnectorsService } from "@bedrock/core/connectors";
import type {
  DocumentDetails,
  DocumentTransitionAction,
  DocumentWithOperationId,
  DocumentsService,
} from "@bedrock/core/documents";
import type { OrchestrationService } from "@bedrock/core/orchestration";
import { noopLogger, type CorrelationContext, type Logger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

import {
  postPaymentIntentWithConnectorFlow,
  type PaymentIntentPostResult,
} from "./internal/post-intent";
import { type PaymentIntentPayload, type PaymentResolutionPayload } from "./validation";

export interface PaymentsServiceDeps {
  db: Database;
  documents: Pick<
    DocumentsService,
    | "createDraft"
    | "list"
    | "get"
    | "getDetails"
    | "transition"
  >;
  connectors: Pick<
    ConnectorsService,
    | "createIntentFromDocument"
    | "getIntentByDocumentId"
    | "listAttempts"
    | "listEvents"
    | "enqueueAttempt"
  >;
  orchestration: Pick<OrchestrationService, "selectNextProviderForIntent">;
  logger?: Logger;
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;

type PaymentIntentTransitionAction = Exclude<DocumentTransitionAction, "repost">;

export function createPaymentsService(deps: PaymentsServiceDeps) {
  const { db, documents, connectors, orchestration } = deps;
  const log = deps.logger?.child({ svc: "payments" }) ?? noopLogger;

  async function createDraft(input: {
    payload: PaymentIntentPayload;
    createIdempotencyKey: string;
    actorUserId: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.createDraft({
      docType: "payment_intent",
      payload: input.payload,
      createIdempotencyKey: input.createIdempotencyKey,
      actorUserId: input.actorUserId,
      requestContext: input.requestContext,
    });
  }

  async function list(input?: {
    limit?: number;
    offset?: number;
    kind?: "intent" | "resolution" | "all";
  }) {
    const docType =
      input?.kind === "resolution"
        ? ["payment_resolution"]
        : input?.kind === "all"
          ? ["payment_intent", "payment_resolution"]
          : ["payment_intent"];

    return documents.list({
      docType,
      limit: input?.limit ?? 50,
      offset: input?.offset ?? 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  }

  async function get(documentId: string) {
    return documents.get("payment_intent", documentId);
  }

  async function getDetails(documentId: string, actorUserId: string): Promise<{
    document: DocumentDetails["document"];
    details: DocumentDetails;
    connectorIntent: Awaited<ReturnType<ConnectorsService["getIntentByDocumentId"]>>;
    attempts: Awaited<ReturnType<ConnectorsService["listAttempts"]>>;
    events: Awaited<ReturnType<ConnectorsService["listEvents"]>>;
  }> {
    const details = await documents.getDetails("payment_intent", documentId, actorUserId);
    const connectorIntent = await connectors.getIntentByDocumentId(documentId);
    const attempts = connectorIntent
      ? await connectors.listAttempts({ intentId: connectorIntent.id })
      : [];
    const events = connectorIntent
      ? await connectors.listEvents({ intentId: connectorIntent.id })
      : [];

    return {
      document: details.document,
      details,
      connectorIntent,
      attempts,
      events,
    };
  }

  async function forwardIntentTransition(input: {
    action: PaymentIntentTransitionAction;
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.transition({
      action: input.action,
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });
  }

  async function transitionIntent(input: {
    action: PaymentIntentTransitionAction;
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }): Promise<DocumentWithOperationId | PaymentIntentPostResult> {
    if (input.action !== "post") {
      return forwardIntentTransition(input);
    }

    const posted = await forwardIntentTransition({
      ...input,
      action: "post",
    });

    return postPaymentIntentWithConnectorFlow({
      deps: {
        db,
        connectors,
        orchestration,
        log,
      },
      posted,
      actorUserId: input.actorUserId,
    });
  }

  async function createResolution(input: {
    payload: PaymentResolutionPayload;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    const draft = await documents.createDraft({
      docType: "payment_resolution",
      createIdempotencyKey: `${input.idempotencyKey}:draft`,
      payload: input.payload,
      actorUserId: input.actorUserId,
      requestContext: input.requestContext,
    });
    await documents.transition({
      action: "submit",
      docType: "payment_resolution",
      documentId: draft.document.id,
      actorUserId: input.actorUserId,
      idempotencyKey: `${input.idempotencyKey}:submit`,
      requestContext: input.requestContext,
    });
    return documents.transition({
      action: "post",
      docType: "payment_resolution",
      documentId: draft.document.id,
      actorUserId: input.actorUserId,
      idempotencyKey: `${input.idempotencyKey}:post`,
      requestContext: input.requestContext,
    });
  }

  return {
    createDraft,
    list,
    get,
    getDetails,
    transitionIntent,
    createResolution,
  };
}

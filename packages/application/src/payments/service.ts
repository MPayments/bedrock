import { eq } from "drizzle-orm";

import type { Database } from "@bedrock/kernel/db/types";
import { noopLogger, type CorrelationContext, type Logger } from "@bedrock/kernel";
import type { ConnectorsService } from "@bedrock/core/connectors";
import { AccountBindingNotFoundError } from "@bedrock/core/counterparty-accounts";
import type {
  DocumentDetails,
  DocumentWithOperationId,
  DocumentsService,
} from "@bedrock/core/documents";
import { schema as counterpartyAccountsSchema } from "@bedrock/core/counterparty-accounts/schema";
import type { OrchestrationService } from "@bedrock/core/orchestration";

import {
  PaymentIntentPayloadSchema,
  type PaymentIntentPayload,
  type PaymentResolutionPayload,
} from "./validation";

export interface PaymentsServiceDeps {
  db: Database;
  documents: Pick<
    DocumentsService,
    | "createDraft"
    | "list"
    | "get"
    | "getDetails"
    | "submit"
    | "approve"
    | "reject"
    | "post"
    | "cancel"
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

async function resolveSourceBookId(db: Database, sourceCounterpartyAccountId: string) {
  const [binding] = await db
    .select({
      bookId: counterpartyAccountsSchema.counterpartyAccountBindings.bookId,
    })
    .from(counterpartyAccountsSchema.counterpartyAccountBindings)
    .where(
      eq(
        counterpartyAccountsSchema.counterpartyAccountBindings.counterpartyAccountId,
        sourceCounterpartyAccountId,
      ),
    )
    .limit(1);

  if (!binding?.bookId) {
    throw new AccountBindingNotFoundError(sourceCounterpartyAccountId);
  }
  return binding.bookId;
}

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

  async function submit(input: {
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.submit({
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });
  }

  async function approve(input: {
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.approve({
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });
  }

  async function reject(input: {
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.reject({
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });
  }

  async function cancel(input: {
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }) {
    return documents.cancel({
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });
  }

  async function post(input: {
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }): Promise<{
    document: DocumentWithOperationId["document"];
    postingOperationId: string | null;
    connectorIntentId: string;
    firstAttemptId: string;
    firstProviderCode: string;
  }> {
    const posted = await documents.post({
      docType: "payment_intent",
      documentId: input.documentId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestContext: input.requestContext,
    });

    const payload = PaymentIntentPayloadSchema.parse(posted.document.payload);
    const bookId = await resolveSourceBookId(db, payload.sourceCounterpartyAccountId);

    const connectorIntent = await connectors.createIntentFromDocument({
      documentId: posted.document.id,
      docType: posted.document.docType,
      direction: payload.direction,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      corridor: payload.corridor,
      providerConstraint: payload.providerConstraint ?? undefined,
      metadata: {
        bookId,
        sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
        destinationCounterpartyAccountId: payload.destinationCounterpartyAccountId,
      },
      idempotencyKey: `${input.idempotencyKey}:connector-intent`,
      actorUserId: input.actorUserId,
    });

    const plan = await orchestration.selectNextProviderForIntent({
      intentId: connectorIntent.id,
      bookId,
      riskScore: payload.riskScore,
      countryFrom: payload.countryFrom,
      countryTo: payload.countryTo,
    });

    const firstAttempt = await connectors.enqueueAttempt({
      intentId: connectorIntent.id,
      providerCode: plan.selected.providerCode,
      providerRoute: plan.selected.degradationOrder[0] ?? payload.corridor,
      requestPayload: {
        paymentIntentDocumentId: posted.document.id,
        amountMinor: payload.amountMinor.toString(),
        currency: payload.currency,
        direction: payload.direction,
      },
      idempotencyKey: `${input.idempotencyKey}:attempt:1`,
      actorUserId: input.actorUserId,
    });

    log.info("Payment posted and routed", {
      documentId: posted.document.id,
      connectorIntentId: connectorIntent.id,
      providerCode: plan.selected.providerCode,
      attemptId: firstAttempt.id,
    });

    return {
      document: posted.document,
      postingOperationId: posted.postingOperationId,
      connectorIntentId: connectorIntent.id,
      firstAttemptId: firstAttempt.id,
      firstProviderCode: plan.selected.providerCode,
    };
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
    await documents.submit({
      docType: "payment_resolution",
      documentId: draft.document.id,
      actorUserId: input.actorUserId,
      idempotencyKey: `${input.idempotencyKey}:submit`,
      requestContext: input.requestContext,
    });
    return documents.post({
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
    submit,
    approve,
    reject,
    cancel,
    post,
    createResolution,
  };
}

import type { Document } from "@bedrock/documents/schema";
import type { Transaction } from "@bedrock/persistence";

import type { DocumentsIdempotencyScope } from "../idempotency";
import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDocumentWithOperationId,
  createModuleContext,
  insertDocumentEvent,
  loadDocumentWithOperationId,
  lockDocument,
  resolveModuleForDocument,
} from "../internal/helpers";
import { persistDocumentPolicyDenial } from "../internal/policy";
import type {
  DocumentModule,
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
  DocumentWithOperationId,
} from "../types";

export interface DocumentTransitionIdempotencyContext {
  tx: Transaction;
  document: Document;
  module: DocumentModule;
}

export interface DocumentTransitionEvent {
  eventType: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reasonMeta?: Record<string, unknown> | null;
}

export interface DocumentTransitionExecutionResult {
  document: Document;
  postingOperationId: string | null;
  events?: DocumentTransitionEvent[];
}

export interface DocumentTransitionExecutionContext {
  services: DocumentsServiceContext;
  tx: Transaction;
  input: DocumentTransitionInput;
  moduleContext: ReturnType<typeof createModuleContext>;
  document: Document;
  module: DocumentModule;
}

export interface DocumentTransitionSpec {
  scope: DocumentsIdempotencyScope;
  needsDocumentForIdempotencyKey?: boolean;
  resolveIdempotencyKey(input: {
    transition: DocumentTransitionInput;
    context: DocumentTransitionIdempotencyContext | null;
  }): Promise<string> | string;
  execute(
    input: DocumentTransitionExecutionContext,
  ): Promise<DocumentTransitionExecutionResult>;
}

export type DocumentTransitionSpecs = Record<
  DocumentTransitionAction,
  DocumentTransitionSpec
>;

async function insertTransitionEvents(input: {
  tx: Transaction;
  transition: DocumentTransitionInput;
  events: DocumentTransitionEvent[];
  requestContext?: DocumentRequestContext;
}) {
  for (const event of input.events) {
    await insertDocumentEvent(input.tx, {
      documentId: input.transition.documentId,
      eventType: event.eventType,
      actorId: input.transition.actorUserId,
      requestId: input.requestContext?.requestId,
      correlationId: input.requestContext?.correlationId,
      traceId: input.requestContext?.traceId,
      causationId: input.requestContext?.causationId,
      before: event.before,
      after: event.after,
      reasonMeta: event.reasonMeta ?? null,
    });
  }
}

export async function runDocumentTransition(input: {
  services: DocumentsServiceContext;
  transition: DocumentTransitionInput;
  spec: DocumentTransitionSpec;
}): Promise<DocumentWithOperationId> {
  const { services, spec, transition } = input;

  try {
    return await services.db.transaction(async (tx) => {
      let preparedForIdempotency: DocumentTransitionIdempotencyContext | null =
        null;

      if (spec.needsDocumentForIdempotencyKey) {
        const document = await lockDocument(
          tx,
          transition.documentId,
          transition.docType,
        );
        preparedForIdempotency = {
          tx,
          document,
          module: resolveModuleForDocument(services.registry, document),
        };
      }

      const idempotencyKey = await spec.resolveIdempotencyKey({
        transition,
        context: preparedForIdempotency,
      });

      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: transition.actorUserId,
        now: new Date(),
        log: services.log,
        operationIdempotencyKey: null,
      });

      return services.idempotency.withIdempotencyTx({
        tx,
        scope: spec.scope,
        idempotencyKey,
        request: {
          action: transition.action,
          docType: transition.docType,
          documentId: transition.documentId,
          actorUserId: transition.actorUserId,
          transitionIdempotencyKey: idempotencyKey,
        },
        actorId: transition.actorUserId,
        serializeResult: (result: DocumentWithOperationId) => ({
          documentId: result.document.id,
          postingOperationId: result.postingOperationId,
        }),
        loadReplayResult: async ({
          storedResult,
        }: {
          storedResult:
            | { documentId?: string; postingOperationId?: string | null }
            | null;
        }) =>
          loadDocumentWithOperationId(
            tx,
            transition.docType,
            String(storedResult?.documentId ?? transition.documentId),
            typeof storedResult?.postingOperationId === "string"
              ? storedResult.postingOperationId
              : null,
            services.registry,
          ),
        handler: async () => {
          const document =
            preparedForIdempotency?.document ??
            (await lockDocument(tx, transition.documentId, transition.docType));
          const module =
            preparedForIdempotency?.module ??
            resolveModuleForDocument(services.registry, document);

          const result = await spec.execute({
            services,
            tx,
            input: transition,
            moduleContext,
            document,
            module,
          });

          if (result.events && result.events.length > 0) {
            await insertTransitionEvents({
              tx,
              transition,
              events: result.events,
              requestContext: transition.requestContext,
            });
          }

          return buildDocumentWithOperationId({
            registry: services.registry,
            document: result.document,
            postingOperationId: result.postingOperationId,
          });
        },
      });
    });
  } catch (error) {
    await persistDocumentPolicyDenial(services.db, error);
    throw error;
  }
}

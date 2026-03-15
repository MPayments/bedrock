import type {
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
  DocumentWithOperationId,
} from "../../contracts/service";
import type { Document } from "../../domain/document";
import type { DocumentModule } from "../../plugins";
import type {
  DocumentEventsRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../documents/ports";
import type { DocumentsLedgerCommitPort } from "../posting/ports";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { mapDocumentDomainError } from "../shared/map-domain-error";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../shared/module-resolution";
import type { DocumentsIdempotencyScope } from "../shared/documents-idempotency";
import { persistDocumentPolicyDenial } from "../shared/policy";

export interface DocumentTransitionIdempotencyContext {
  documentsCommand: DocumentsCommandRepository;
  documentOperations: DocumentOperationsRepository;
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
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentOperations: DocumentOperationsRepository;
  ledger: DocumentsLedgerCommitPort;
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
  documentEvents: DocumentEventsRepository;
  transition: DocumentTransitionInput;
  events: DocumentTransitionEvent[];
  requestContext?: DocumentRequestContext;
}) {
  for (const event of input.events) {
    await input.documentEvents.insertDocumentEvent({
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
    return await services.transactions.withTransaction(
      async ({
        documentEvents,
        documentOperations,
        documentsCommand,
        idempotency,
        ledger,
        moduleRuntime,
      }) => {
        let preparedForIdempotency: DocumentTransitionIdempotencyContext | null =
          null;

        if (spec.needsDocumentForIdempotencyKey) {
          const document = await loadDocumentOrThrow(documentsCommand, {
            documentId: transition.documentId,
            docType: transition.docType,
            forUpdate: true,
          });
          preparedForIdempotency = {
            documentsCommand,
            documentOperations,
            document,
            module: resolveModuleForDocument(services.registry, document),
          };
        }

        const idempotencyKey = await spec.resolveIdempotencyKey({
          transition,
          context: preparedForIdempotency,
        });

        const moduleContext = createModuleContext({
          actorUserId: transition.actorUserId,
          now: services.now(),
          log: services.log,
          operationIdempotencyKey: null,
          runtime: moduleRuntime,
        });

        return idempotency.withIdempotency({
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
          loadReplayResult: async ({ storedResult }) =>
            loadDocumentWithOperationId(
              {
                documents: documentsCommand,
                documentOperations,
              },
              {
                docType: transition.docType,
                documentId: String(storedResult?.documentId ?? transition.documentId),
                postingOperationId:
                  typeof storedResult?.postingOperationId === "string"
                    ? storedResult.postingOperationId
                    : null,
                registry: services.registry,
              },
            ),
          handler: async () => {
            const document =
              preparedForIdempotency?.document ??
              (await loadDocumentOrThrow(documentsCommand, {
                documentId: transition.documentId,
                docType: transition.docType,
                forUpdate: true,
              }));
            const module =
              preparedForIdempotency?.module ??
              resolveModuleForDocument(services.registry, document);

            const result = await spec.execute({
              services,
              documentsCommand,
              documentEvents,
              documentOperations,
              ledger,
              input: transition,
              moduleContext,
              document,
              module,
            });

            if (result.events && result.events.length > 0) {
              await insertTransitionEvents({
                documentEvents,
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
      },
    );
  } catch (error) {
    await persistDocumentPolicyDenial(services.transactions, error);
    throw mapDocumentDomainError(error, {
      documentId: transition.documentId,
      docType: transition.docType,
    });
  }
}

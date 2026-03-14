import type { DocumentsIdempotencyScope } from "../../domain/idempotency";
import type { Document } from "../../domain/types";
import type {
  DocumentModule,
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
  DocumentWithOperationId,
} from "../../types";
import type {
  DocumentsLedgerCommitPort,
  DocumentsRepository,
} from "../ports";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import { createModuleContext, resolveModuleForDocument } from "../shared/module-resolution";
import { persistDocumentPolicyDenial } from "../shared/policy";

export interface DocumentTransitionIdempotencyContext {
  repository: DocumentsRepository;
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
  repository: DocumentsRepository;
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
  repository: DocumentsRepository;
  transition: DocumentTransitionInput;
  events: DocumentTransitionEvent[];
  requestContext?: DocumentRequestContext;
}) {
  for (const event of input.events) {
    await input.repository.insertDocumentEvent({
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
      async ({ idempotency, ledger, moduleDb, repository }) => {
        let preparedForIdempotency: DocumentTransitionIdempotencyContext | null =
          null;

        if (spec.needsDocumentForIdempotencyKey) {
          const document = await loadDocumentOrThrow(repository, {
            documentId: transition.documentId,
            docType: transition.docType,
            forUpdate: true,
          });
          preparedForIdempotency = {
            repository,
            document,
            module: resolveModuleForDocument(services.registry, document),
          };
        }

        const idempotencyKey = await spec.resolveIdempotencyKey({
          transition,
          context: preparedForIdempotency,
        });

        const moduleContext = createModuleContext({
          db: moduleDb,
          actorUserId: transition.actorUserId,
          now: new Date(),
          log: services.log,
          operationIdempotencyKey: null,
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
          loadReplayResult: async ({
            storedResult,
          }: {
            storedResult:
              | { documentId?: string; postingOperationId?: string | null }
              | null;
          }) =>
            loadDocumentWithOperationId(repository, {
              docType: transition.docType,
              documentId: String(storedResult?.documentId ?? transition.documentId),
              postingOperationId:
                typeof storedResult?.postingOperationId === "string"
                  ? storedResult.postingOperationId
                  : null,
              registry: services.registry,
            }),
          handler: async () => {
            const document =
              preparedForIdempotency?.document ??
              (await loadDocumentOrThrow(repository, {
                documentId: transition.documentId,
                docType: transition.docType,
                forUpdate: true,
              }));
            const module =
              preparedForIdempotency?.module ??
              resolveModuleForDocument(services.registry, document);

            const result = await spec.execute({
              services,
              repository,
              ledger,
              input: transition,
              moduleContext,
              document,
              module,
            });

            if (result.events && result.events.length > 0) {
              await insertTransitionEvents({
                repository,
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
    throw error;
  }
}

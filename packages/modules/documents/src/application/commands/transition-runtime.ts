import type {
  DocumentRequestContext,
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/commands";
import type { DocumentWithOperationId } from "../../contracts/dto";
import type { Document } from "../../domain/document";
import type { DocumentModule } from "../../plugins";
import type {
  DocumentEventsRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../documents/ports";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import type { DocumentsServiceContext } from "../shared/context";
import type { DocumentsIdempotencyScope } from "../shared/documents-idempotency";
import { mapDocumentDomainError } from "../shared/map-domain-error";
import {
  insertDocumentEvents,
  type DocumentActionEvent,
} from "../shared/action-runtime";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../shared/module-resolution";
import { persistDocumentPolicyDenial } from "../shared/policy";

export interface DocumentTransitionIdempotencyContext {
  documentsCommand: DocumentsCommandRepository;
  documentOperations: DocumentOperationsRepository;
  document: Document;
  module: DocumentModule;
}

export interface DocumentTransitionExecutionResult {
  document: Document;
  postingOperationId: string | null;
  events?: DocumentActionEvent[];
}

export interface DocumentTransitionExecutionContext {
  services: DocumentsServiceContext;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentOperations: DocumentOperationsRepository;
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
  Exclude<DocumentTransitionAction, "post" | "repost">,
  DocumentTransitionSpec
>;

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
              input: transition,
              moduleContext,
              document,
              module,
            });

            if (result.events && result.events.length > 0) {
              await insertDocumentEvents({
                documentEvents,
                events: result.events,
                documentId: transition.documentId,
                actorUserId: transition.actorUserId,
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

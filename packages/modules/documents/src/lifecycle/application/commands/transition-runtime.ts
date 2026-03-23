import type { DocumentWithOperationId } from "../../../documents/application/contracts/dto";
import type {
  DocumentEventsRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../../../documents/application/ports";
import type { DocumentSnapshot } from "../../../documents/domain/document";
import type { DocumentModule } from "../../../plugins";
import {
  insertDocumentEvents,
  type DocumentActionEvent,
} from "../../../shared/application/action-runtime";
import type { DocumentsIdempotencyScope } from "../../../shared/application/documents-idempotency";
import { mapDocumentDomainError } from "../../../shared/application/map-domain-error";
import {
  createModuleContext,
  resolveModuleForDocument,
} from "../../../shared/application/module-resolution";
import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../contracts/commands";
import type { LifecycleServiceDeps } from "../service-deps";
import {
  buildDocumentWithOperationId,
  loadDocumentOrThrow,
  loadDocumentWithOperationId,
} from "../shared/actions";
import { persistDocumentPolicyDenial } from "../shared/policy";

export interface DocumentTransitionIdempotencyContext {
  documentsCommand: DocumentsCommandRepository;
  documentOperations: DocumentOperationsRepository;
  document: DocumentSnapshot;
  module: DocumentModule;
}

export interface DocumentTransitionExecutionResult {
  document: DocumentSnapshot;
  postingOperationId: string | null;
  events?: DocumentActionEvent[];
}

export interface DocumentTransitionExecutionContext {
  services: LifecycleServiceDeps;
  transaction: unknown;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentOperations: DocumentOperationsRepository;
  input: DocumentTransitionInput;
  moduleContext: ReturnType<typeof createModuleContext>;
  document: DocumentSnapshot;
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
  services: LifecycleServiceDeps;
  transition: DocumentTransitionInput;
  spec: DocumentTransitionSpec;
}): Promise<DocumentWithOperationId> {
  const { services, spec, transition } = input;

  try {
    return await services.commandUow.run(
      async ({
        transaction,
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
          now: services.runtime.now(),
          log: services.runtime.log,
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
              transaction,
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
    await persistDocumentPolicyDenial(services.commandUow, error);
    throw mapDocumentDomainError(error, {
      documentId: transition.documentId,
      docType: transition.docType,
    });
  }
}

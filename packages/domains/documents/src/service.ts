import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import {
  AuthContextToken,
  type AuthContext,
} from "@bedrock/security";
import { AccountingDomainServiceToken } from "@multihansa/accounting";
import {
  InvalidStateError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from "@multihansa/common/errors";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@multihansa/common/operations";
import {
  BadRequestDomainError,
  ConflictDomainError,
  DbToken,
  ForbiddenDomainError,
  MissingIdempotencyKeyDomainError,
  NotFoundDomainError,
  RequestContextToken,
  adaptBedrockLogger,
  readActorRole,
  requireActorUserId,
  requireIdempotencyKey,
} from "@multihansa/common/bedrock";
import {
  LedgerEngineToken,
  LedgerReadServiceToken,
} from "@multihansa/ledger";
import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentSystemOnlyTypeError,
  DocumentValidationError,
} from "./errors";
import { type DocumentTransitionAction } from "./types";
import { z } from "zod";

import { createDocumentsService as createDocumentsRuntime } from "./runtime";
import { isSystemOnlyDocumentType } from "./doc-type-rules";
import {
  CreateDocumentInputSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
} from "./validation";
import type { DocumentAction } from "./state-machine";
import {
  DocumentDetailsSchema,
  DocumentSchema,
  DocumentsListResponseSchema,
  toDocumentDetailsDto,
  toDocumentDto,
} from "./schemas";
import { DocumentRegistryToken } from "./tokens";

const DocumentParamsSchema = z.object({
  docType: z.string().min(1),
  id: z.uuid(),
});

const CreateDocumentActionSchema = z.object({
  docType: z.string().min(1),
  body: CreateDocumentInputSchema,
});

const UpdateDocumentActionSchema = z.object({
  docType: z.string().min(1),
  id: z.uuid(),
  body: UpdateDocumentInputSchema,
});

const TransitionActionSchema = z.object({
  docType: z.string().min(1),
  id: z.uuid(),
  action: z.enum(["submit", "approve", "reject", "post", "cancel", "repost"]),
});

const DOCUMENT_ACTION_TO_PERMISSION = {
  edit: "update",
  submit: "submit",
  approve: "approve",
  reject: "reject",
  post: "post",
  cancel: "cancel",
  repost: "post",
} as const;

const DOCUMENT_ACTION_TO_PUBLIC_ACTION = {
  edit: "update",
  submit: "submit",
  approve: "approve",
  reject: "reject",
  post: "post",
  cancel: "cancel",
  repost: "repost",
} as const satisfies Record<DocumentAction, string>;

function assertPublicMutationAllowed(input: {
  docType: string;
  action:
    | "create"
    | "update"
    | "submit"
    | "approve"
    | "reject"
    | "post"
    | "cancel"
    | "repost";
  role: string | null;
}) {
  if (
    input.docType === "period_reopen" &&
    input.action === "create" &&
    input.role === "admin"
  ) {
    return;
  }

  if (isSystemOnlyDocumentType(input.docType)) {
    throw new DocumentSystemOnlyTypeError(input.docType);
  }
}

function filterAllowedDocumentActions(input: {
  auth: AuthContext;
  docType: string;
  role: string | null;
  allowedActions: DocumentAction[];
}) {
  return input.allowedActions.filter((action) => {
    try {
      assertPublicMutationAllowed({
        docType: input.docType,
        action: DOCUMENT_ACTION_TO_PUBLIC_ACTION[action],
        role: input.role,
      });
    } catch {
      return false;
    }

    return input.auth.hasPermission(
      `documents:${DOCUMENT_ACTION_TO_PERMISSION[action]}`,
    );
  });
}

function withPublicAllowedActions<
  TResource extends {
    document: { docType: string };
    allowedActions: DocumentAction[];
  },
>(input: {
  auth: Parameters<typeof readActorRole>[0];
  resource: TResource;
  role: string | null;
}) {
  return {
    ...input.resource,
    allowedActions: filterAllowedDocumentActions({
      auth: input.auth,
      docType: input.resource.document.docType,
      role: input.role,
      allowedActions: input.resource.allowedActions,
    }),
  };
}

function toDomainFailure(cause: unknown) {
  if (cause instanceof DocumentNotFoundError || cause instanceof NotFoundError) {
    return error(NotFoundDomainError, { message: cause.message });
  }

  if (cause instanceof PermissionError || cause instanceof DocumentPolicyDeniedError) {
    return error(ForbiddenDomainError, { message: cause.message });
  }

  if (
    cause instanceof DocumentValidationError ||
    cause instanceof DocumentGraphError ||
    cause instanceof ValidationError
  ) {
    return error(BadRequestDomainError, { message: cause.message });
  }

  if (
    cause instanceof DocumentSystemOnlyTypeError ||
    cause instanceof InvalidStateError ||
    cause instanceof DocumentPostingNotRequiredError ||
    cause instanceof ActionReceiptConflictError ||
    cause instanceof ActionReceiptStoredError
  ) {
    return error(ConflictDomainError, { message: cause.message });
  }

  throw cause;
}

function getDocumentsRuntime(ctx: {
  accounting: Parameters<typeof createDocumentsRuntime>[0]["accounting"];
  db: Parameters<typeof createDocumentsRuntime>[0]["db"];
  ledger: Parameters<typeof createDocumentsRuntime>[0]["ledger"];
  ledgerReadService: Parameters<
    typeof createDocumentsRuntime
  >[0]["ledgerReadService"];
  logger: BedrockLogger;
  registry: Parameters<typeof createDocumentsRuntime>[0]["registry"];
}) {
  return createDocumentsRuntime({
    accounting: ctx.accounting,
    db: ctx.db,
    ledger: ctx.ledger,
    ledgerReadService: ctx.ledgerReadService,
    logger: adaptBedrockLogger(ctx.logger),
    registry: ctx.registry,
  });
}

export const documentsService = defineService("documents", {
  deps: {
    accounting: AccountingDomainServiceToken,
    auth: AuthContextToken,
    db: DbToken,
    ledger: LedgerEngineToken,
    ledgerReadService: LedgerReadServiceToken,
    requestContext: RequestContextToken,
    registry: DocumentRegistryToken,
  },
  ctx: ({
    accounting,
    auth,
    db,
    ledger,
    ledgerReadService,
    requestContext,
    registry,
  }) => ({
    accounting,
    auth,
    db,
    ledger,
    ledgerReadService,
    requestContext,
    registry,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListDocumentsQuerySchema,
      output: DocumentsListResponseSchema,
      handler: async ({ ctx, input }) => {
        const actorUserId = requireActorUserId(ctx.auth);
        const role = readActorRole(ctx.auth);
        const result = await getDocumentsRuntime(ctx).list(input, actorUserId);

        return {
          ...result,
          data: result.data.map((item) =>
            DocumentSchema.parse(
              toDocumentDto(
                withPublicAllowedActions({
                  auth: ctx.auth,
                  resource: item,
                  role,
                }),
              ),
            ),
          ),
        };
      },
    }),
    create: action({
      input: CreateDocumentActionSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          const documents = getDocumentsRuntime(ctx);
          assertPublicMutationAllowed({
            docType: input.docType,
            action: "create",
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await documents.createDraft({
                docType: input.docType,
                createIdempotencyKey: input.body.createIdempotencyKey,
                payload: input.body.input,
                actorUserId: requireActorUserId(ctx.auth),
                requestContext: ctx.requestContext,
              }),
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    update: action({
      input: UpdateDocumentActionSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        MissingIdempotencyKeyDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        const idempotencyKey = requireIdempotencyKey(ctx.requestContext);
        if (typeof idempotencyKey !== "string") {
          return idempotencyKey;
        }

        try {
          const documents = getDocumentsRuntime(ctx);
          assertPublicMutationAllowed({
            docType: input.docType,
            action: "update",
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await documents.updateDraft({
                docType: input.docType,
                documentId: input.id,
                payload: input.body.input,
                actorUserId: requireActorUserId(ctx.auth),
                idempotencyKey,
                requestContext: ctx.requestContext,
              }),
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    get: action({
      input: DocumentParamsSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          const result = await getDocumentsRuntime(ctx).get(
            input.docType,
            input.id,
            requireActorUserId(ctx.auth),
          );

          return DocumentSchema.parse(
            toDocumentDto(
              withPublicAllowedActions({
                auth: ctx.auth,
                resource: result,
                role: readActorRole(ctx.auth),
              }),
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    getDetails: action({
      input: DocumentParamsSchema,
      output: DocumentDetailsSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          const details = await getDocumentsRuntime(ctx).getDetails(
            input.docType,
            input.id,
            requireActorUserId(ctx.auth),
          );

          return DocumentDetailsSchema.parse(
            toDocumentDetailsDto(
              withPublicAllowedActions({
                auth: ctx.auth,
                resource: details,
                role: readActorRole(ctx.auth),
              }),
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    transition: action({
      input: TransitionActionSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        MissingIdempotencyKeyDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        const idempotencyKey = requireIdempotencyKey(ctx.requestContext);
        if (typeof idempotencyKey !== "string") {
          return idempotencyKey;
        }

        try {
          const documents = getDocumentsRuntime(ctx);
          assertPublicMutationAllowed({
            docType: input.docType,
            action: input.action,
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await documents.transition({
                action: input.action as DocumentTransitionAction,
                docType: input.docType,
                documentId: input.id,
                actorUserId: requireActorUserId(ctx.auth),
                idempotencyKey,
                requestContext: ctx.requestContext,
              }),
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
  }),
});

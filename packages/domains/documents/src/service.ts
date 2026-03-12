import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import {
  AuthContextToken,
  type AuthContext,
} from "@bedrock/security";
import { z } from "zod";

import { AccountingDomainServiceToken } from "@multihansa/accounting";
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
  LedgerEngineToken,
  LedgerReadServiceToken,
} from "@multihansa/ledger";

import { isSystemOnlyDocumentType } from "./doc-type-rules";
import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentSystemOnlyTypeError,
  DocumentValidationError,
} from "./errors";
import { createCreateDraftHandler } from "./commands/create-draft";
import { createTransitionHandler } from "./commands/transition";
import { createUpdateDraftHandler } from "./commands/update-draft";
import {
  DocumentDetailsSchema,
  DocumentSchema,
  DocumentsListResponseSchema,
  toDocumentDetailsDto,
  toDocumentDto,
} from "./schemas";
import { createDocumentsServiceContext } from "./internal/context";
import { createGetDocumentDetailsQuery } from "./queries/get-document-details";
import { createGetDocumentQuery } from "./queries/get-document";
import { createListDocumentsQuery } from "./queries/list-documents";
import type { DocumentAction } from "./state-machine";
import { DocumentRegistryToken } from "./tokens";
import { type DocumentTransitionAction } from "./types";
import {
  CreateDocumentInputSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
} from "./validation";

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

function createDocumentsContext(ctx: {
  accounting: Parameters<typeof createDocumentsServiceContext>[0]["accounting"];
  db: Parameters<typeof createDocumentsServiceContext>[0]["db"];
  ledger: Parameters<typeof createDocumentsServiceContext>[0]["ledger"];
  ledgerReadService: Parameters<
    typeof createDocumentsServiceContext
  >[0]["ledgerReadService"];
  logger: BedrockLogger;
  registry: Parameters<typeof createDocumentsServiceContext>[0]["registry"];
}) {
  return createDocumentsServiceContext({
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
        const result = await createListDocumentsQuery(
          createDocumentsContext(ctx),
        )(input, actorUserId);

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
          const createDraft = createCreateDraftHandler(
            createDocumentsContext(ctx),
          );
          assertPublicMutationAllowed({
            docType: input.docType,
            action: "create",
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await createDraft({
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
          const updateDraft = createUpdateDraftHandler(
            createDocumentsContext(ctx),
          );
          assertPublicMutationAllowed({
            docType: input.docType,
            action: "update",
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await updateDraft({
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
          const result = await createGetDocumentQuery(
            createDocumentsContext(ctx),
          )(
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
          const details = await createGetDocumentDetailsQuery(
            createDocumentsContext(ctx),
          )(
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
          const transition = createTransitionHandler(
            createDocumentsContext(ctx),
          );
          assertPublicMutationAllowed({
            docType: input.docType,
            action: input.action,
            role: readActorRole(ctx.auth),
          });

          return DocumentSchema.parse(
            toDocumentDto(
              await transition({
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

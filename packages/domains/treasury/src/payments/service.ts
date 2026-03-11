import { defineService, error } from "@bedrock/core";
import { AuthContextToken } from "@bedrock/security";
import { z } from "zod";

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
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentValidationError,
} from "@multihansa/documents";
import { PaymentIntentInputSchema } from "@multihansa/treasury/payments";

import {
  PaymentDetailsSchema,
  PaymentListResponseSchema,
} from "./schemas";
import {
  BadRequestDomainError,
  ConflictDomainError,
  ForbiddenDomainError,
  MissingIdempotencyKeyDomainError,
  NotFoundDomainError,
} from "@multihansa/common/bedrock";
import { toApiJson } from "@multihansa/common/bedrock";
import { RequestContextToken } from "@multihansa/common/bedrock";
import { PaymentsDomainServiceToken } from "../tokens";
import { DocumentSchema, toDocumentDto } from "@multihansa/documents";
import { requireActorUserId } from "@multihansa/common/bedrock";
import { requireIdempotencyKey } from "@multihansa/common/bedrock";

const CreatePaymentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

const ListPaymentsQuerySchema = z.object({
  kind: z.enum(["intent", "resolution", "all"]).default("intent"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const PaymentIdParamSchema = z.object({
  id: z.uuid(),
});

const PaymentTransitionActionSchema = z.object({
  id: z.uuid(),
  action: z.enum(["submit", "approve", "reject", "post", "cancel"]),
});

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
    cause instanceof InvalidStateError ||
    cause instanceof DocumentPostingNotRequiredError ||
    cause instanceof ActionReceiptConflictError ||
    cause instanceof ActionReceiptStoredError
  ) {
    return error(ConflictDomainError, { message: cause.message });
  }

  throw cause;
}

export const paymentsService = defineService("payments", {
  deps: {
    auth: AuthContextToken,
    requestContext: RequestContextToken,
    payments: PaymentsDomainServiceToken,
  },
  ctx: ({ auth, payments, requestContext }) => ({
    auth,
    requestContext,
    payments,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListPaymentsQuerySchema,
      output: PaymentListResponseSchema,
      handler: async ({ ctx, input }) => {
        const result = await ctx.payments.list(input);
        return {
          ...result,
          data: result.data.map((item) => DocumentSchema.parse(toDocumentDto(item))),
        };
      },
    }),
    create: action({
      input: CreatePaymentInputSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          return DocumentSchema.parse(
            toDocumentDto(
              await ctx.payments.createDraft({
                payload: PaymentIntentInputSchema.parse(input.input),
                createIdempotencyKey: input.createIdempotencyKey,
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
    get: action({
      input: PaymentIdParamSchema,
      output: DocumentSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          return DocumentSchema.parse(toDocumentDto(await ctx.payments.get(input.id)));
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    getDetails: action({
      input: PaymentIdParamSchema,
      output: PaymentDetailsSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        ForbiddenDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        try {
          const result = await ctx.payments.getDetails(
            input.id,
            requireActorUserId(ctx.auth),
          );
          return PaymentDetailsSchema.parse(
            toApiJson(
              {
                ...result,
                document: toDocumentDto({
                  document: result.document,
                  postingOperationId: null,
                  allowedActions: [],
                }),
              },
              { normalizeMoney: true },
            ),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    transition: action({
      input: PaymentTransitionActionSchema,
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
          return DocumentSchema.parse(
            toDocumentDto(
              await ctx.payments.transitionIntent({
                action: input.action,
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

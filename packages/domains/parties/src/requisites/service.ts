import { defineService, error } from "@bedrock/core";
import { ValidationError } from "@multihansa/common/errors";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import { CounterpartyNotFoundError } from "@multihansa/parties/counterparties";
import { OrganizationNotFoundError } from "@multihansa/parties/organizations";
import {
  CreateRequisiteInputSchema,
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  RequisiteBindingNotFoundError,
  RequisiteBindingOwnerTypeError,
  RequisiteNotFoundError,
  RequisiteProviderNotActiveError,
  RequisiteSchema,
  UpdateRequisiteInputSchema,
  UpsertRequisiteAccountingBindingInputSchema,
} from "@multihansa/parties/requisites";
import {
  RequisiteAccountingBindingSchema,
  RequisiteOptionSchema,
  RequisiteOptionsResponseSchema,
} from "@multihansa/parties/requisites/contracts";
import { z } from "zod";

import { BadRequestDomainError, NotFoundDomainError } from "@multihansa/common/bedrock";
import { buildOptionsResponse } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { RequisitesDomainServiceToken } from "../tokens";

const PaginatedRequisitesSchema = createPaginatedListSchema(RequisiteSchema);

const UpdateRequisiteActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateRequisiteInputSchema,
});

const UpsertBindingActionInputSchema = z.object({
  id: z.uuid(),
  input: UpsertRequisiteAccountingBindingInputSchema,
});

function mapRequisiteMutationError(cause: unknown) {
  if (
    cause instanceof ValidationError ||
    cause instanceof RequisiteProviderNotActiveError ||
    cause instanceof RequisiteBindingOwnerTypeError
  ) {
    return error(BadRequestDomainError, {
      message: cause.message,
    });
  }

  if (
    cause instanceof RequisiteNotFoundError ||
    cause instanceof OrganizationNotFoundError ||
    cause instanceof CounterpartyNotFoundError
  ) {
    return error(NotFoundDomainError, {
      message: cause.message,
    });
  }

  return null;
}

export const requisitesService = defineService("requisites", {
  deps: {
    requisites: RequisitesDomainServiceToken,
  },
  ctx: ({ requisites }) => ({
    requisites,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListRequisitesQuerySchema,
      output: PaginatedRequisitesSchema,
      handler: async ({ ctx, input }) => ctx.requisites.list(input),
    }),
    options: action({
      input: ListRequisiteOptionsQuerySchema,
      output: RequisiteOptionsResponseSchema,
      handler: async ({ ctx, input }) => {
        const result = await ctx.requisites.listOptions({
          ownerType: input.ownerType,
          ownerId: input.ownerId,
        });

        return buildOptionsResponse(result, (item) => RequisiteOptionSchema.parse(item));
      },
    }),
    create: action({
      input: CreateRequisiteInputSchema,
      output: RequisiteSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisites.create(input);
        } catch (cause) {
          return mapRequisiteMutationError(cause) ?? Promise.reject(cause);
        }
      },
    }),
    get: action({
      input: IdParamSchema,
      output: RequisiteSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisites.findById(input.id);
        } catch (cause) {
          if (cause instanceof RequisiteNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateRequisiteActionInputSchema,
      output: RequisiteSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisites.update(input.id, input.input);
        } catch (cause) {
          return mapRequisiteMutationError(cause) ?? Promise.reject(cause);
        }
      },
    }),
    delete: action({
      input: IdParamSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await ctx.requisites.remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof RequisiteNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    getBinding: action({
      input: IdParamSchema,
      output: RequisiteAccountingBindingSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisites.getBinding(input.id);
        } catch (cause) {
          if (
            cause instanceof RequisiteNotFoundError ||
            cause instanceof RequisiteBindingNotFoundError
          ) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    upsertBinding: action({
      input: UpsertBindingActionInputSchema,
      output: RequisiteAccountingBindingSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisites.upsertBinding(input.id, input.input);
        } catch (cause) {
          return mapRequisiteMutationError(cause) ?? Promise.reject(cause);
        }
      },
    }),
  }),
});

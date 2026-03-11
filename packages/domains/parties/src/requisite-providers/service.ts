import { defineService, error } from "@bedrock/core";
import { ValidationError } from "@multihansa/common/errors";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  RequisiteProviderNotFoundError,
  RequisiteProviderSchema,
  UpdateRequisiteProviderInputSchema,
} from "@multihansa/parties/requisite-providers";
import {
  RequisiteProviderOptionSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@multihansa/parties/requisite-providers/contracts";
import { z } from "zod";

import {
  BadRequestDomainError,
  NotFoundDomainError,
} from "@multihansa/common/bedrock";
import { buildOptionsResponse } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { RequisiteProvidersDomainServiceToken } from "../tokens";

const PaginatedRequisiteProvidersSchema = createPaginatedListSchema(
  RequisiteProviderSchema,
);

const UpdateRequisiteProviderActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateRequisiteProviderInputSchema,
});

export const requisiteProvidersService = defineService("requisite-providers", {
  deps: {
    requisiteProviders: RequisiteProvidersDomainServiceToken,
  },
  ctx: ({ requisiteProviders }) => ({
    requisiteProviders,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListRequisiteProvidersQuerySchema,
      output: PaginatedRequisiteProvidersSchema,
      handler: async ({ ctx, input }) => ctx.requisiteProviders.list(input),
    }),
    options: action({
      output: RequisiteProviderOptionsResponseSchema,
      handler: async ({ ctx }) => {
        const result = await ctx.requisiteProviders.list({
          limit: 1000,
          offset: 0,
          sortBy: "name",
          sortOrder: "asc",
        });

        return buildOptionsResponse(result.data, (item) =>
          RequisiteProviderOptionSchema.parse({
            id: item.id,
            kind: item.kind,
            name: item.name,
            label: item.name,
          }),
        );
      },
    }),
    create: action({
      input: CreateRequisiteProviderInputSchema,
      output: RequisiteProviderSchema,
      errors: [BadRequestDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisiteProviders.create(input);
        } catch (cause) {
          if (cause instanceof ValidationError) {
            return error(BadRequestDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    get: action({
      input: IdParamSchema,
      output: RequisiteProviderSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisiteProviders.findById(input.id);
        } catch (cause) {
          if (cause instanceof RequisiteProviderNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateRequisiteProviderActionInputSchema,
      output: RequisiteProviderSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.requisiteProviders.update(input.id, input.input);
        } catch (cause) {
          if (cause instanceof RequisiteProviderNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof ValidationError) {
            return error(BadRequestDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    delete: action({
      input: IdParamSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await ctx.requisiteProviders.remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof RequisiteProviderNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

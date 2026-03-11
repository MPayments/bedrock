import { defineService, error } from "@bedrock/core";
import { ValidationError } from "@multihansa/common/errors";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
  OrganizationSchema,
  UpdateOrganizationInputSchema,
} from "@multihansa/parties/organizations";
import {
  OrganizationOptionSchema,
  OrganizationOptionsResponseSchema,
} from "@multihansa/parties/organizations/contracts";
import { z } from "zod";

import {
  BadRequestDomainError,
  ConflictDomainError,
  NotFoundDomainError,
} from "@multihansa/common/bedrock";
import { buildOptionsResponse } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { OrganizationsDomainServiceToken } from "../tokens";

const PaginatedOrganizationsSchema = createPaginatedListSchema(OrganizationSchema);

const UpdateOrganizationActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateOrganizationInputSchema,
});

export const organizationsService = defineService("organizations", {
  deps: {
    organizations: OrganizationsDomainServiceToken,
  },
  ctx: ({ organizations }) => ({
    organizations,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListOrganizationsQuerySchema,
      output: PaginatedOrganizationsSchema,
      handler: async ({ ctx, input }) => ctx.organizations.list(input),
    }),
    options: action({
      output: OrganizationOptionsResponseSchema,
      handler: async ({ ctx }) => {
        const result = await ctx.organizations.list({
          limit: 1000,
          offset: 0,
          sortBy: "shortName",
          sortOrder: "asc",
        });

        return buildOptionsResponse(result.data, (item) =>
          OrganizationOptionSchema.parse({
            id: item.id,
            shortName: item.shortName,
            label: item.shortName,
          }),
        );
      },
    }),
    create: action({
      input: CreateOrganizationInputSchema,
      output: OrganizationSchema,
      errors: [BadRequestDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.organizations.create(input);
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
      output: OrganizationSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.organizations.findById(input.id);
        } catch (cause) {
          if (cause instanceof OrganizationNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateOrganizationActionInputSchema,
      output: OrganizationSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.organizations.update(input.id, input.input);
        } catch (cause) {
          if (cause instanceof OrganizationNotFoundError) {
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
      errors: [NotFoundDomainError, ConflictDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await ctx.organizations.remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof OrganizationNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof OrganizationDeleteConflictError) {
            return error(ConflictDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

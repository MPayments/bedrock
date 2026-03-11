import { defineService, error } from "@bedrock/core";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateCustomerInputSchema,
  CustomerDeleteConflictError,
  CustomerNotFoundError,
  CustomerSchema,
  ListCustomersQuerySchema,
  UpdateCustomerInputSchema,
} from "@multihansa/parties/customers";
import { z } from "zod";

import { ConflictDomainError, NotFoundDomainError } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { CustomersDomainServiceToken } from "../tokens";

const PaginatedCustomersSchema = createPaginatedListSchema(CustomerSchema);

const UpdateCustomerActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateCustomerInputSchema,
});

export const customersService = defineService("customers", {
  deps: {
    customers: CustomersDomainServiceToken,
  },
  ctx: ({ customers }) => ({
    customers,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListCustomersQuerySchema,
      output: PaginatedCustomersSchema,
      handler: async ({ ctx, input }) => ctx.customers.list(input),
    }),
    create: action({
      input: CreateCustomerInputSchema,
      output: CustomerSchema,
      handler: async ({ ctx, input }) => ctx.customers.create(input),
    }),
    get: action({
      input: IdParamSchema,
      output: CustomerSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.customers.findById(input.id);
        } catch (cause) {
          if (cause instanceof CustomerNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateCustomerActionInputSchema,
      output: CustomerSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.customers.update(input.id, input.input);
        } catch (cause) {
          if (cause instanceof CustomerNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
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
          await ctx.customers.remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof CustomerNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof CustomerDeleteConflictError) {
            return error(ConflictDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

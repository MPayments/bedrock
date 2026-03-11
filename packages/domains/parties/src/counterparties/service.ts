import { defineService, error } from "@bedrock/core";
import { z } from "zod";

import { BadRequestDomainError, NotFoundDomainError } from "@multihansa/common/bedrock";
import { buildOptionsResponse } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyNotFoundError,
  CounterpartySchema,
  CreateCounterpartyInputSchema,
  ListCounterpartiesQuerySchema,
  UpdateCounterpartyInputSchema,
} from "@multihansa/parties/counterparties";
import {
  CounterpartyOptionSchema,
  CounterpartyOptionsResponseSchema,
} from "@multihansa/parties/counterparties/contracts";

import { CounterpartiesDomainServiceToken } from "../tokens";

const PaginatedCounterpartiesSchema = createPaginatedListSchema(
  CounterpartySchema,
);

const UpdateCounterpartyActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateCounterpartyInputSchema,
});

export const counterpartiesService = defineService("counterparties", {
  deps: {
    counterparties: CounterpartiesDomainServiceToken,
  },
  ctx: ({ counterparties }) => ({
    counterparties,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListCounterpartiesQuerySchema,
      output: PaginatedCounterpartiesSchema,
      handler: async ({ ctx, input }) => ctx.counterparties.list(input),
    }),
    options: action({
      output: CounterpartyOptionsResponseSchema,
      handler: async ({ ctx }) => {
        const result = await ctx.counterparties.list({
          limit: 200,
          offset: 0,
          sortBy: "shortName",
          sortOrder: "asc",
        });

        return buildOptionsResponse(result, (counterparty) =>
          CounterpartyOptionSchema.parse({
            id: counterparty.id,
            shortName: counterparty.shortName,
            label: counterparty.shortName,
          }),
        );
      },
    }),
    create: action({
      input: CreateCounterpartyInputSchema,
      output: CounterpartySchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.counterparties.create(input);
        } catch (cause) {
          if (
            cause instanceof CounterpartyGroupNotFoundError ||
            cause instanceof CounterpartyCustomerNotFoundError
          ) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof CounterpartyGroupRuleError) {
            return error(BadRequestDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    get: action({
      input: IdParamSchema,
      output: CounterpartySchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.counterparties.findById(input.id);
        } catch (cause) {
          if (cause instanceof CounterpartyNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateCounterpartyActionInputSchema,
      output: CounterpartySchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.counterparties.update(input.id, input.input);
        } catch (cause) {
          if (
            cause instanceof CounterpartyNotFoundError ||
            cause instanceof CounterpartyGroupNotFoundError ||
            cause instanceof CounterpartyCustomerNotFoundError
          ) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof CounterpartyGroupRuleError) {
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
          await ctx.counterparties.remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof CounterpartyNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

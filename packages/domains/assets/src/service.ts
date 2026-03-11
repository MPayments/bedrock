import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import {
  ConflictDomainError,
  DbToken,
  IdParamSchema,
  NotFoundDomainError,
  adaptBedrockLogger,
  buildOptionsResponse,
} from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import { z } from "zod";

import {
  CurrencyOptionSchema,
  CurrencyOptionsResponseSchema,
} from "./contracts";
import {
  CurrencyDeleteConflictError,
  CurrencyNotFoundError,
} from "./errors";
import { createCurrenciesService as createCurrenciesRuntime } from "./runtime";
import {
  CreateCurrencyInputSchema,
  CurrencySchema,
  ListCurrenciesQuerySchema,
  UpdateCurrencyInputSchema,
} from "./validation";

const PaginatedCurrenciesSchema = createPaginatedListSchema(CurrencySchema);

const UpdateCurrencyActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateCurrencyInputSchema,
});

function getCurrenciesRuntime(ctx: {
  db: Parameters<typeof createCurrenciesRuntime>[0]["db"];
  logger: BedrockLogger;
}) {
  return createCurrenciesRuntime({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
  });
}

export const currenciesService = defineService("currencies", {
  deps: {
    db: DbToken,
  },
  ctx: ({ db }) => ({
    db,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListCurrenciesQuerySchema,
      output: PaginatedCurrenciesSchema,
      handler: async ({ ctx, input }) => getCurrenciesRuntime(ctx).list(input),
    }),
    options: action({
      output: CurrencyOptionsResponseSchema,
      handler: async ({ ctx }) => {
        const result = await getCurrenciesRuntime(ctx).list({
          limit: 200,
          offset: 0,
          sortBy: "code",
          sortOrder: "asc",
        });

        return buildOptionsResponse(result, (currency) =>
          CurrencyOptionSchema.parse({
            id: currency.id,
            code: currency.code,
            name: currency.name,
            label: `${currency.code} - ${currency.name}`,
          }),
        );
      },
    }),
    create: action({
      input: CreateCurrencyInputSchema,
      output: CurrencySchema,
      handler: async ({ ctx, input }) =>
        getCurrenciesRuntime(ctx).create(input),
    }),
    get: action({
      input: IdParamSchema,
      output: CurrencySchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getCurrenciesRuntime(ctx).findById(input.id);
        } catch (cause) {
          if (cause instanceof CurrencyNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    update: action({
      input: UpdateCurrencyActionInputSchema,
      output: CurrencySchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await getCurrenciesRuntime(ctx).update(input.id, input.input);
        } catch (cause) {
          if (cause instanceof CurrencyNotFoundError) {
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
          await getCurrenciesRuntime(ctx).remove(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof CurrencyNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof CurrencyDeleteConflictError) {
            return error(ConflictDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

import { defineService, error } from "@bedrock/core";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyGroupSchema,
  CounterpartySystemGroupDeleteError,
  CreateCounterpartyGroupInputSchema,
  ListCounterpartyGroupsQuerySchema,
  UpdateCounterpartyGroupInputSchema,
} from "@multihansa/parties/counterparties";
import {
  CounterpartyGroupOptionSchema,
  CounterpartyGroupOptionsResponseSchema,
} from "@multihansa/parties/counterparties/contracts";
import { z } from "zod";

import {
  BadRequestDomainError,
  ConflictDomainError,
  NotFoundDomainError,
} from "@multihansa/common/bedrock";
import { buildOptionsResponse } from "@multihansa/common/bedrock";
import { IdParamSchema } from "@multihansa/common/bedrock";
import { CounterpartiesDomainServiceToken } from "../tokens";

const UpdateCounterpartyGroupActionInputSchema = z.object({
  id: z.uuid(),
  input: UpdateCounterpartyGroupInputSchema,
});

function buildCounterpartyGroupOptionLabel(group: {
  name: string;
  customerLabel?: string | null;
}) {
  const name = group.name.trim();
  const customerLabel = group.customerLabel?.trim();

  if (customerLabel && customerLabel.length > 0 && customerLabel !== name) {
    return `${name} · ${customerLabel}`;
  }

  return name;
}

export const counterpartyGroupsService = defineService("counterparty-groups", {
  deps: {
    counterparties: CounterpartiesDomainServiceToken,
  },
  ctx: ({ counterparties }) => ({
    counterparties,
  }),
  actions: ({ action }) => ({
    list: action({
      input: ListCounterpartyGroupsQuerySchema,
      output: CounterpartyGroupSchema.array(),
      handler: async ({ ctx, input }) => ctx.counterparties.listGroups(input),
    }),
    options: action({
      output: CounterpartyGroupOptionsResponseSchema,
      handler: async ({ ctx }) => {
        const groups = await ctx.counterparties.listGroups({
          includeSystem: true,
        });

        return buildOptionsResponse(groups, (group) =>
          CounterpartyGroupOptionSchema.parse({
            id: group.id,
            code: group.code,
            name: group.name,
            parentId: group.parentId,
            customerId: group.customerId,
            customerLabel: group.customerLabel ?? null,
            isSystem: group.isSystem,
            label: buildCounterpartyGroupOptionLabel(group),
          }),
        );
      },
    }),
    create: action({
      input: CreateCounterpartyGroupInputSchema,
      output: CounterpartyGroupSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.counterparties.createGroup(input);
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
    update: action({
      input: UpdateCounterpartyGroupActionInputSchema,
      output: CounterpartyGroupSchema,
      errors: [BadRequestDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          return await ctx.counterparties.updateGroup(input.id, input.input);
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
    delete: action({
      input: IdParamSchema,
      errors: [ConflictDomainError, NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await ctx.counterparties.removeGroup(input.id);
          return undefined;
        } catch (cause) {
          if (cause instanceof CounterpartyGroupNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (cause instanceof CounterpartySystemGroupDeleteError) {
            return error(ConflictDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
  }),
});

import { eq } from "drizzle-orm";

import { schema } from "@bedrock/parties/counterparties/schema";

import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";
import {
  assertCustomerExists,
  CUSTOMERS_ROOT_GROUP_CODE,
  TREASURY_INTERNAL_LEDGER_GROUP_CODE,
  TREASURY_ROOT_GROUP_CODE,
  resolveGroupMembershipClassification,
} from "../internal/group-rules";
import {
  CreateCounterpartyGroupInputSchema,
  type CounterpartyGroup,
  type CreateCounterpartyGroupInput,
} from "../validation";

export function createCreateCounterpartyGroupHandler(
  context: CounterpartiesServiceContext,
) {
  const { db, log } = context;

  return async function createCounterpartyGroup(
    input: CreateCounterpartyGroupInput,
  ): Promise<CounterpartyGroup> {
    const validated = CreateCounterpartyGroupInputSchema.parse(input);
    let customerId: string | null = validated.customerId ?? null;

    if (
      validated.code === TREASURY_ROOT_GROUP_CODE ||
      validated.code === CUSTOMERS_ROOT_GROUP_CODE ||
      validated.code === TREASURY_INTERNAL_LEDGER_GROUP_CODE
    ) {
      throw new CounterpartyGroupRuleError(
        "System root group codes are reserved",
      );
    }

    if (!validated.parentId && customerId) {
      throw new CounterpartyGroupRuleError(
        "Root custom groups cannot have customerId",
      );
    }

    if (validated.parentId) {
      const [parent] = await db
        .select({
          id: schema.counterpartyGroups.id,
          customerId: schema.counterpartyGroups.customerId,
        })
        .from(schema.counterpartyGroups)
        .where(eq(schema.counterpartyGroups.id, validated.parentId))
        .limit(1);

      if (!parent) {
        throw new CounterpartyGroupNotFoundError(validated.parentId);
      }

      const classification = await resolveGroupMembershipClassification(db, [
        validated.parentId,
      ]);
      const parentRoot =
        classification.rootsByGroupId.get(validated.parentId) ?? null;

      if (parent.customerId) {
        customerId = customerId ?? parent.customerId;
        if (customerId !== parent.customerId) {
          throw new CounterpartyGroupRuleError(
            "Child group customerId must match scoped parent customerId",
          );
        }
      }

      if (parentRoot !== CUSTOMERS_ROOT_GROUP_CODE && customerId) {
        throw new CounterpartyGroupRuleError(
          "customerId is allowed only in customers tree groups",
        );
      }
    }

    if (customerId) {
      await assertCustomerExists(db, customerId);
    }

    const [created] = await db
      .insert(schema.counterpartyGroups)
      .values({
        code: validated.code,
        name: validated.name,
        description: validated.description ?? null,
        parentId: validated.parentId ?? null,
        customerId,
        isSystem: false,
      })
      .returning();

    log.info("Counterparty group created", {
      id: created!.id,
      code: created!.code,
    });

    return created!;
  };
}

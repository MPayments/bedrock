import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/counterparties/schema";

import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";
import {
  assertCustomerExists,
} from "../internal/group-rules";
import {
  UpdateCounterpartyGroupInputSchema,
  type CounterpartyGroup,
  type UpdateCounterpartyGroupInput,
} from "../validation";

export function createUpdateCounterpartyGroupHandler(
  context: CounterpartiesServiceContext,
) {
  const { db, log } = context;

  return async function updateCounterpartyGroup(
    id: string,
    input: UpdateCounterpartyGroupInput,
  ): Promise<CounterpartyGroup> {
    const validated = UpdateCounterpartyGroupInputSchema.parse(input);

    const [existing] = await db
      .select()
      .from(schema.counterpartyGroups)
      .where(eq(schema.counterpartyGroups.id, id))
      .limit(1);

    if (!existing) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    const isManagedCustomerGroup = existing.code.startsWith("customer:");
    const hasRequestedChanges =
      validated.code !== undefined ||
      validated.name !== undefined ||
      validated.description !== undefined ||
      validated.parentId !== undefined ||
      validated.customerId !== undefined;

    if (isManagedCustomerGroup && hasRequestedChanges) {
      throw new CounterpartyGroupRuleError(
        "Customer-generated groups cannot be modified",
      );
    }

    const nextParentId =
      validated.parentId !== undefined ? validated.parentId : existing.parentId;
    let nextCustomerId =
      validated.customerId !== undefined
        ? validated.customerId
        : existing.customerId;

    if (validated.code?.startsWith("customer:") && !existing.code.startsWith("customer:")) {
      throw new CounterpartyGroupRuleError(
        "Customer-generated group codes are reserved",
      );
    }

    if (nextParentId) {
      if (nextParentId === id) {
        throw new CounterpartyGroupRuleError(
          "Group cannot be parent of itself",
        );
      }

      const allGroups = await db
        .select({
          id: schema.counterpartyGroups.id,
          parentId: schema.counterpartyGroups.parentId,
          customerId: schema.counterpartyGroups.customerId,
        })
        .from(schema.counterpartyGroups);
      const groupMap = new Map(allGroups.map((group) => [group.id, group]));

      const parent = groupMap.get(nextParentId);
      if (!parent) {
        throw new CounterpartyGroupNotFoundError(nextParentId);
      }

      if (parent.customerId) {
        nextCustomerId = nextCustomerId ?? parent.customerId;
        if (nextCustomerId !== parent.customerId) {
          throw new CounterpartyGroupRuleError(
            "Child group customerId must match scoped parent customerId",
          );
        }
      } else if (nextCustomerId) {
        throw new CounterpartyGroupRuleError(
          "customerId is allowed only under customer-generated parent groups",
        );
      }

      const visited = new Set<string>();
      let cursor = parent;

      while (cursor) {
        if (visited.has(cursor.id)) {
          throw new CounterpartyGroupRuleError(
            `Counterparty group hierarchy loop detected at group ${cursor.id}`,
          );
        }
        visited.add(cursor.id);

        if (cursor.id === id) {
          throw new CounterpartyGroupRuleError(
            "Group cannot become a child of its own descendant",
          );
        }

        if (!cursor.parentId) {
          break;
        }

        const nextCursor = groupMap.get(cursor.parentId);
        if (!nextCursor) {
          break;
        }
        cursor = nextCursor;
      }
    }

    if (!nextParentId && nextCustomerId && !existing.code.startsWith("customer:")) {
      throw new CounterpartyGroupRuleError(
        "Root custom groups cannot have customerId",
      );
    }

    if (
      nextCustomerId &&
      (validated.customerId !== undefined || validated.parentId !== undefined)
    ) {
      await assertCustomerExists(db, nextCustomerId);
    }

    const fields: Record<string, unknown> = {};

    if (validated.code !== undefined) fields.code = validated.code;
    if (validated.name !== undefined) fields.name = validated.name;
    if (validated.description !== undefined) {
      fields.description = validated.description;
    }
    if (validated.parentId !== undefined) fields.parentId = validated.parentId;
    if (
      validated.customerId !== undefined ||
      validated.parentId !== undefined
    ) {
      fields.customerId = nextCustomerId;
    }

    if (Object.keys(fields).length === 0) {
      return existing;
    }

    fields.updatedAt = sql`now()`;

    const [updated] = await db
      .update(schema.counterpartyGroups)
      .set(fields)
      .where(eq(schema.counterpartyGroups.id, id))
      .returning();

    if (!updated) {
      throw new CounterpartyGroupNotFoundError(id);
    }

    log.info("Counterparty group updated", { id });

    return updated;
  };
}

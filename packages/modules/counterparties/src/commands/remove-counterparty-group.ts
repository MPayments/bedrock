import { eq } from "drizzle-orm";

import { schema } from "@bedrock/counterparties/schema";

import {
  CounterpartyGroupNotFoundError,
  CounterpartySystemGroupDeleteError,
} from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";

export function createRemoveCounterpartyGroupHandler(
  context: CounterpartiesServiceContext,
) {
  const { db, log } = context;

  return async function removeCounterpartyGroup(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [group] = await tx
        .select()
        .from(schema.counterpartyGroups)
        .where(eq(schema.counterpartyGroups.id, id))
        .limit(1);

      if (!group) {
        throw new CounterpartyGroupNotFoundError(id);
      }

      if (group.isSystem || group.code.startsWith("customer:")) {
        throw new CounterpartySystemGroupDeleteError(id);
      }

      await tx
        .update(schema.counterpartyGroups)
        .set({ parentId: group.parentId })
        .where(eq(schema.counterpartyGroups.parentId, id));

      await tx
        .delete(schema.counterpartyGroups)
        .where(eq(schema.counterpartyGroups.id, id));
    });

    log.info("Counterparty group deleted", { id });
  };
}

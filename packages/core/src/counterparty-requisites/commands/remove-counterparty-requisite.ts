import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";

import { schema } from "../schema";
import { CounterpartyRequisiteNotFoundError } from "../errors";
import type { CounterpartyRequisitesServiceContext } from "../internal/context";

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    counterpartyId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.counterpartyRequisites.id })
    .from(schema.counterpartyRequisites)
    .where(
      and(
        eq(schema.counterpartyRequisites.counterpartyId, input.counterpartyId),
        eq(schema.counterpartyRequisites.currencyId, input.currencyId),
        isNull(schema.counterpartyRequisites.archivedAt),
        ne(schema.counterpartyRequisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.counterpartyRequisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.counterpartyRequisites.id, replacement.id));
}

export function createRemoveCounterpartyRequisiteHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function removeCounterpartyRequisite(id: string) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.counterpartyRequisites)
        .where(
          and(
            eq(schema.counterpartyRequisites.id, id),
            isNull(schema.counterpartyRequisites.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      await tx
        .update(schema.counterpartyRequisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyRequisites.id, id));

      if (existing.isDefault) {
        await promoteNextDefaultTx(tx, {
          counterpartyId: existing.counterpartyId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Counterparty requisite archived", { id });
      return { ok: true as const };
    });
  };
}

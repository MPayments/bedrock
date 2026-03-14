import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform-persistence";

import { RequisiteNotFoundError } from "../errors";
import type { RequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import type { RequisiteOwnerType } from "../validation";

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.requisites.id })
    .from(schema.requisites)
    .where(
      and(
        eq(schema.requisites.ownerType, input.ownerType),
        input.ownerType === "organization"
          ? eq(schema.requisites.organizationId, input.ownerId)
          : eq(schema.requisites.counterpartyId, input.ownerId),
        eq(schema.requisites.currencyId, input.currencyId),
        isNull(schema.requisites.archivedAt),
        ne(schema.requisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.requisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.requisites.id, replacement.id));
}

export function createRemoveRequisiteHandler(context: RequisitesServiceContext) {
  const { db, log } = context;

  return async function removeRequisite(id: string) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.requisites)
        .where(and(eq(schema.requisites.id, id), isNull(schema.requisites.archivedAt)))
        .limit(1);

      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      await tx
        .update(schema.requisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.requisites.id, id));

      if (existing.isDefault) {
        await promoteNextDefaultTx(tx, {
          ownerType: existing.ownerType,
          ownerId:
            existing.ownerType === "organization"
              ? existing.organizationId!
              : existing.counterpartyId!,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Requisite archived", { id });
      return { ok: true as const };
    });
  };
}

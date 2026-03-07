import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";

import { schema } from "../schema";
import { OrganizationRequisiteNotFoundError } from "../errors";
import type { OrganizationRequisitesServiceContext } from "../internal/context";

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    organizationId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.organizationRequisites.id })
    .from(schema.organizationRequisites)
    .where(
      and(
        eq(schema.organizationRequisites.organizationId, input.organizationId),
        eq(schema.organizationRequisites.currencyId, input.currencyId),
        isNull(schema.organizationRequisites.archivedAt),
        ne(schema.organizationRequisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.organizationRequisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.organizationRequisites.id, replacement.id));
}

export function createRemoveOrganizationRequisiteHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function removeOrganizationRequisite(id: string) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.organizationRequisites)
        .where(
          and(
            eq(schema.organizationRequisites.id, id),
            isNull(schema.organizationRequisites.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new OrganizationRequisiteNotFoundError(id);
      }

      await tx
        .update(schema.organizationRequisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.organizationRequisites.id, id));

      if (existing.isDefault) {
        await promoteNextDefaultTx(tx, {
          organizationId: existing.organizationId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Organization requisite archived", { id });
      return { ok: true as const };
    });
  };
}

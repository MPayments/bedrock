import { eq, sql } from "drizzle-orm";

import type { RequisiteProvidersServiceContext } from "../context";
import { RequisiteProviderNotFoundError } from "../errors";
import { schema } from "../schema";

export function createRemoveRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { db, log } = context;

  return async function removeRequisiteProvider(id: string): Promise<void> {
    const [updated] = await db
      .update(schema.requisiteProviders)
      .set({
        archivedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.requisiteProviders.id, id))
      .returning({ id: schema.requisiteProviders.id });

    if (!updated) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider archived", { id });
  };
}

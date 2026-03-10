import { and, eq, isNull } from "drizzle-orm";

import type { RequisiteProvidersServiceContext } from "../context";
import { RequisiteProviderNotFoundError } from "../errors";
import { schema } from "../schema";
import type { RequisiteProvider } from "../validation";

export function createFindRequisiteProviderByIdHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { db } = context;

  return async function findRequisiteProviderById(
    id: string,
  ): Promise<RequisiteProvider> {
    const [row] = await db
      .select()
      .from(schema.requisiteProviders)
      .where(
        and(
          eq(schema.requisiteProviders.id, id),
          isNull(schema.requisiteProviders.archivedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return row;
  };
}

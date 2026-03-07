import { and, eq, isNull } from "drizzle-orm";

import { schema } from "../schema";
import { CounterpartyRequisiteNotFoundError } from "../errors";
import type { CounterpartyRequisitesServiceContext } from "../internal/context";

export function createFindCounterpartyRequisiteByIdHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db } = context;

  return async function findCounterpartyRequisiteById(id: string) {
    const [requisite] = await db
      .select()
      .from(schema.counterpartyRequisites)
      .where(
        and(
          eq(schema.counterpartyRequisites.id, id),
          isNull(schema.counterpartyRequisites.archivedAt),
        ),
      )
      .limit(1);

    if (!requisite) {
      throw new CounterpartyRequisiteNotFoundError(id);
    }

    return requisite;
  };
}

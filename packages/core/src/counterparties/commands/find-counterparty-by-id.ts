import { eq } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparties/schema";

import { CounterpartyNotFoundError } from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";
import { readMembershipIds } from "../internal/group-rules";
import type { Counterparty } from "../validation";

export function createFindCounterpartyByIdHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function findCounterpartyById(
    id: string,
  ): Promise<Counterparty> {
    const [row] = await db
      .select()
      .from(schema.counterparties)
      .where(eq(schema.counterparties.id, id))
      .limit(1);

    if (!row) {
      throw new CounterpartyNotFoundError(id);
    }

    const groupIds = await readMembershipIds(db, id);

    return {
      ...row,
      groupIds,
    };
  };
}

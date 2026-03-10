import { and, eq, isNull } from "drizzle-orm";

import type { RequisitesServiceContext } from "../context";
import { RequisiteNotFoundError } from "../errors";
import { schema } from "../schema";
import { toPublicRequisite } from "../shape";
import type { Requisite } from "../validation";

export function createFindRequisiteByIdHandler(context: RequisitesServiceContext) {
  const { db } = context;

  return async function findRequisiteById(id: string): Promise<Requisite> {
    const [row] = await db
      .select()
      .from(schema.requisites)
      .where(and(eq(schema.requisites.id, id), isNull(schema.requisites.archivedAt)))
      .limit(1);

    if (!row) {
      throw new RequisiteNotFoundError(id);
    }

    return toPublicRequisite(row);
  };
}

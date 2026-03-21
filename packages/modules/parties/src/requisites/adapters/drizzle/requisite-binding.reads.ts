import { eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { organizationRequisiteBindings } from "./schema";
import type { RequisiteBindingReads } from "../../application/ports/requisite-binding.reads";

export class DrizzleRequisiteBindingReads implements RequisiteBindingReads {
  constructor(private readonly db: Queryable) {}

  async findByRequisiteId(requisiteId: string) {
    const [row] = await this.db
      .select()
      .from(organizationRequisiteBindings)
      .where(eq(organizationRequisiteBindings.requisiteId, requisiteId))
      .limit(1);

    return row ?? null;
  }

  async listByRequisiteId(requisiteIds: string[]) {
    const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(organizationRequisiteBindings)
      .where(inArray(organizationRequisiteBindings.requisiteId, uniqueIds));
  }
}

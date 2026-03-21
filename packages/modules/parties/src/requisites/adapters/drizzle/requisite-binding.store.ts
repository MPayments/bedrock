import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { organizationRequisiteBindings } from "./schema";
import type { RequisiteBindingStore } from "../../application/ports/requisite-binding.store";

export class DrizzleRequisiteBindingStore implements RequisiteBindingStore {
  constructor(private readonly db: Queryable) {}

  async upsert(input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }) {
    await this.db
      .insert(organizationRequisiteBindings)
      .values({
        requisiteId: input.requisiteId,
        bookId: input.bookId,
        bookAccountInstanceId: input.bookAccountInstanceId,
        postingAccountNo: input.postingAccountNo,
      })
      .onConflictDoUpdate({
        target: organizationRequisiteBindings.requisiteId,
        set: {
          bookId: input.bookId,
          bookAccountInstanceId: input.bookAccountInstanceId,
          postingAccountNo: input.postingAccountNo,
        },
      });

    const [row] = await this.db
      .select()
      .from(organizationRequisiteBindings)
      .where(eq(organizationRequisiteBindings.requisiteId, input.requisiteId))
      .limit(1);

    return row ?? null;
  }
}

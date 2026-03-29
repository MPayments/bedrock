import { sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { customerMemberships } from "./schema";
import type { CustomerMembershipStore } from "../../application/ports/customer-membership.store";

export class DrizzleCustomerMembershipStore implements CustomerMembershipStore {
  constructor(private readonly db: Queryable) {}

  async upsert(input: { customerId: string; userId: string }) {
    const [membership] = await this.db
      .insert(customerMemberships)
      .values(input)
      .onConflictDoUpdate({
        target: [customerMemberships.customerId, customerMemberships.userId],
        set: { updatedAt: sql`now()` },
      })
      .returning();

    return membership!;
  }
}

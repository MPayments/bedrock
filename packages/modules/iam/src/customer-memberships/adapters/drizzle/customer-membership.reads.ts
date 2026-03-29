import { and, desc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { customerMemberships } from "./schema";
import type { CustomerMembership } from "../../application/contracts/dto";
import type { CustomerMembershipReads } from "../../application/ports/customer-membership.reads";

export class DrizzleCustomerMembershipReads implements CustomerMembershipReads {
  constructor(private readonly db: Queryable) {}

  async hasMembership(input: {
    customerId: string;
    userId: string;
  }): Promise<boolean> {
    const [row] = await this.db
      .select({ customerId: customerMemberships.customerId })
      .from(customerMemberships)
      .where(
        and(
          eq(customerMemberships.customerId, input.customerId),
          eq(customerMemberships.userId, input.userId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async listByUserId(userId: string): Promise<CustomerMembership[]> {
    const rows = await this.db
      .select()
      .from(customerMemberships)
      .where(eq(customerMemberships.userId, userId))
      .orderBy(desc(customerMemberships.createdAt));

    return rows as CustomerMembership[];
  }
}

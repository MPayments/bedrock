import {
  HasCustomerMembershipInputSchema,
  type HasCustomerMembershipInput,
} from "../contracts/queries";
import type { CustomerMembershipReads } from "../ports/customer-membership.reads";

export class HasCustomerMembershipQuery {
  constructor(private readonly reads: CustomerMembershipReads) {}

  async execute(input: HasCustomerMembershipInput) {
    const validated = HasCustomerMembershipInputSchema.parse(input);
    return this.reads.hasMembership(validated);
  }
}

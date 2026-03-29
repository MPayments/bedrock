import {
  ListCustomerMembershipsByUserIdInputSchema,
  type ListCustomerMembershipsByUserIdInput,
} from "../contracts/queries";
import type { CustomerMembershipReads } from "../ports/customer-membership.reads";

export class ListCustomerMembershipsByUserIdQuery {
  constructor(private readonly reads: CustomerMembershipReads) {}

  async execute(input: ListCustomerMembershipsByUserIdInput) {
    const validated = ListCustomerMembershipsByUserIdInputSchema.parse(input);
    return this.reads.listByUserId(validated.userId);
  }
}

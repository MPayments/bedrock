import type { CustomerMembership } from "../contracts/dto";

export interface CustomerMembershipStore {
  upsert(input: {
    customerId: string;
    userId: string;
  }): Promise<CustomerMembership>;
}

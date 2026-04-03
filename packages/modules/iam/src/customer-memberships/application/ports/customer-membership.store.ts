import type { CustomerMembership } from "../contracts/dto";

export interface CustomerMembershipStore {
  upsert(input: {
    customerId: string;
    userId: string;
    role: string;
    status: string;
  }): Promise<CustomerMembership>;
}

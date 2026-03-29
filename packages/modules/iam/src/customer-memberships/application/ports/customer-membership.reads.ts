import type { CustomerMembership } from "../contracts/dto";

export interface CustomerMembershipReads {
  hasMembership(input: {
    customerId: string;
    userId: string;
  }): Promise<boolean>;
  listByUserId(userId: string): Promise<CustomerMembership[]>;
}

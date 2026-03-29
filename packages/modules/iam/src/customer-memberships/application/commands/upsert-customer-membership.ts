import {
  UpsertCustomerMembershipInputSchema,
  type UpsertCustomerMembershipInput,
} from "../contracts/commands";
import type { CustomerMembershipsCommandUnitOfWork } from "../ports/customer-memberships.uow";

export class UpsertCustomerMembershipCommand {
  constructor(
    private readonly unitOfWork: CustomerMembershipsCommandUnitOfWork,
  ) {}

  async execute(input: UpsertCustomerMembershipInput) {
    const validated = UpsertCustomerMembershipInputSchema.parse(input);

    return this.unitOfWork.run((tx) =>
      tx.customerMembershipStore.upsert(validated),
    );
  }
}

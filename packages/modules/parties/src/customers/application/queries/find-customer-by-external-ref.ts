import { CustomerNotFoundError } from "../errors";
import type { CustomerReads } from "../ports/customer.reads";

export class FindCustomerByExternalRefQuery {
  constructor(private readonly reads: CustomerReads) {}

  async execute(externalRef: string) {
    const customer = await this.reads.findByExternalRef(externalRef);
    if (!customer) {
      throw new CustomerNotFoundError(externalRef);
    }

    return customer;
  }
}

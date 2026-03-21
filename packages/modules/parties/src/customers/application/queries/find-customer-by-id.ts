import { CustomerNotFoundError } from "../errors";
import type { CustomerReads } from "../ports/customer.reads";

export class FindCustomerByIdQuery {
  constructor(private readonly customerReads: CustomerReads) {}

  async execute(id: string) {
    const customer = await this.customerReads.findById(id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  }
}

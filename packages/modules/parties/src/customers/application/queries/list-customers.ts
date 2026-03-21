import {
  ListCustomersQuerySchema,
  type ListCustomersQuery as ListCustomersQueryInput,
} from "../contracts/queries";
import type { CustomerReads } from "../ports/customer.reads";

export class ListCustomersQuery {
  constructor(private readonly customerReads: CustomerReads) {}

  async execute(input?: ListCustomersQueryInput) {
    const query = ListCustomersQuerySchema.parse(input ?? {});

    return this.customerReads.list(query);
  }
}

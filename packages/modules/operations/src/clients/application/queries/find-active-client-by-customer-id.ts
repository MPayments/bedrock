import type { ClientReads } from "../ports/client.reads";

export class FindActiveClientByCustomerIdQuery {
  constructor(private readonly reads: ClientReads) {}

  async execute(customerId: string) {
    return this.reads.findActiveByCustomerId(customerId);
  }
}

import {
  ListClientsQuerySchema,
  type ListClientsQuery as ListClientsQueryInput,
} from "../contracts/queries";
import type { ClientReads } from "../ports/client.reads";

export class ListClientsQuery {
  constructor(private readonly reads: ClientReads) {}

  async execute(input?: ListClientsQueryInput) {
    const query = ListClientsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}

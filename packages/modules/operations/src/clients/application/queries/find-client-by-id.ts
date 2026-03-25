import { ClientNotFoundError } from "../../../errors";
import type { ClientReads } from "../ports/client.reads";

export class FindClientByIdQuery {
  constructor(private readonly reads: ClientReads) {}

  async execute(id: number) {
    const client = await this.reads.findById(id);
    if (!client) {
      throw new ClientNotFoundError(id);
    }
    return client;
  }
}

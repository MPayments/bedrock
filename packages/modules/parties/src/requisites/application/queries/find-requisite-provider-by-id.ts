import { RequisiteProviderNotFoundError } from "../errors";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";

export class FindRequisiteProviderByIdQuery {
  constructor(private readonly reads: RequisiteProviderReads) {}

  async execute(id: string) {
    const provider = await this.reads.findActiveById(id);

    if (!provider) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return provider;
  }
}

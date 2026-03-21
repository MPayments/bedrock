import { OrganizationNotFoundError } from "../errors";
import type { OrganizationReads } from "../ports/organization.reads";

export class FindOrganizationByIdQuery {
  constructor(private readonly reads: OrganizationReads) {}

  async execute(id: string) {
    const organization = await this.reads.findById(id);

    if (!organization) {
      throw new OrganizationNotFoundError(id);
    }

    return organization;
  }
}

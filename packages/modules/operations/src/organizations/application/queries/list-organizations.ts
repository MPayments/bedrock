import { ListOrganizationsQuerySchema } from "../contracts/queries";
import type { OrganizationReads } from "../ports/organization.reads";

export class ListOrganizationsQuery {
  constructor(private readonly reads: OrganizationReads) {}

  async execute(input?: unknown) {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}

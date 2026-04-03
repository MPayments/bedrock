import {
  ListOrganizationsQuerySchema,
  type ListOrganizationsInput,
} from "../contracts/queries";
import type { OrganizationReads } from "../ports/organization.reads";

export class ListOrganizationsQuery {
  constructor(private readonly reads: OrganizationReads) {}

  execute(input?: ListOrganizationsInput) {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}

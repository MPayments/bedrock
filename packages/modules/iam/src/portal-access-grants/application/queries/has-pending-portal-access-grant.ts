import {
  HasPendingPortalAccessGrantInputSchema,
  type HasPendingPortalAccessGrantInput,
} from "../contracts/queries";
import type { PortalAccessGrantReads } from "../ports/portal-access-grant.reads";

export class HasPendingPortalAccessGrantQuery {
  constructor(private readonly reads: PortalAccessGrantReads) {}

  async execute(input: HasPendingPortalAccessGrantInput) {
    const validated = HasPendingPortalAccessGrantInputSchema.parse(input);
    return this.reads.hasPendingGrant(validated.userId);
  }
}

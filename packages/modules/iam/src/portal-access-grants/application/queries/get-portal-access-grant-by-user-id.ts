import {
  GetPortalAccessGrantByUserIdInputSchema,
  type GetPortalAccessGrantByUserIdInput,
} from "../contracts/queries";
import type { PortalAccessGrantReads } from "../ports/portal-access-grant.reads";

export class GetPortalAccessGrantByUserIdQuery {
  constructor(private readonly reads: PortalAccessGrantReads) {}

  async execute(input: GetPortalAccessGrantByUserIdInput) {
    const validated = GetPortalAccessGrantByUserIdInputSchema.parse(input);
    return this.reads.findByUserId(validated.userId);
  }
}

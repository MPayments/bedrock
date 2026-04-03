import {
  RevokePortalAccessGrantInputSchema,
  type RevokePortalAccessGrantInput,
} from "../contracts/commands";
import type { PortalAccessGrantsUnitOfWork } from "../ports/portal-access-grants.uow";

export class RevokePortalAccessGrantCommand {
  constructor(private readonly unitOfWork: PortalAccessGrantsUnitOfWork) {}

  async execute(input: RevokePortalAccessGrantInput) {
    const validated = RevokePortalAccessGrantInputSchema.parse(input);

    return this.unitOfWork.run((tx) =>
      tx.portalAccessGrantStore.revokeByUserId(validated.userId),
    );
  }
}

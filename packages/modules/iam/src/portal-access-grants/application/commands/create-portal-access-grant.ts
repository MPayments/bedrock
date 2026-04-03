import {
  CreatePortalAccessGrantInputSchema,
  type CreatePortalAccessGrantInput,
} from "../contracts/commands";
import type { PortalAccessGrantsUnitOfWork } from "../ports/portal-access-grants.uow";

export class CreatePortalAccessGrantCommand {
  constructor(private readonly unitOfWork: PortalAccessGrantsUnitOfWork) {}

  async execute(input: CreatePortalAccessGrantInput) {
    const validated = CreatePortalAccessGrantInputSchema.parse(input);

    return this.unitOfWork.run((tx) =>
      tx.portalAccessGrantStore.upsert(validated),
    );
  }
}

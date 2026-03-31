import {
  ConsumePortalAccessGrantInputSchema,
  type ConsumePortalAccessGrantInput,
} from "../contracts/commands";
import type { PortalAccessGrantsUnitOfWork } from "../ports/portal-access-grants.uow";

export class ConsumePortalAccessGrantCommand {
  constructor(private readonly unitOfWork: PortalAccessGrantsUnitOfWork) {}

  async execute(input: ConsumePortalAccessGrantInput) {
    const validated = ConsumePortalAccessGrantInputSchema.parse(input);

    return this.unitOfWork.run((tx) =>
      tx.portalAccessGrantStore.consumeByUserId(validated.userId),
    );
  }
}

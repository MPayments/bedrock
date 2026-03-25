import type { ModuleRuntime } from "@bedrock/shared/core";

import { ClientNotFoundError } from "../../../errors";
import {
  UpdateClientInputSchema,
  type UpdateClientInput,
} from "../contracts/commands";
import type { ClientsCommandUnitOfWork } from "../ports/clients.uow";

export class UpdateClientCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ClientsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateClientInput) {
    const validated = UpdateClientInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.clientStore.findById(validated.id);
      if (!existing) {
        throw new ClientNotFoundError(validated.id);
      }

      const updated = await tx.clientStore.update(validated);

      // Auto-manage contract if contract fields are provided
      if (
        validated.agentOrganizationId &&
        validated.agentOrganizationBankDetailsId
      ) {
        const existingContract = existing.contractId
          ? await tx.contractStore.findById(existing.contractId)
          : null;

        if (!existingContract) {
          // No existing contract → create new
          const contract = await tx.contractStore.create({
            clientId: validated.id,
            contractNumber: validated.contractNumber ?? undefined,
            contractDate: validated.contractDate ?? undefined,
            agentFee: validated.agentFee ?? undefined,
            fixedFee: validated.fixedFee ?? undefined,
            agentOrganizationId: validated.agentOrganizationId,
            agentOrganizationBankDetailsId:
              validated.agentOrganizationBankDetailsId,
          });
          await tx.clientStore.update({
            id: validated.id,
            contractId: contract.id,
          });

          this.runtime.log.info("Contract auto-created for client", {
            clientId: validated.id,
            contractId: contract.id,
          });
        } else if (
          validated.contractNumber &&
          existingContract.contractNumber !== validated.contractNumber
        ) {
          // Contract number changed → delete old, create new
          const newContract = await tx.contractStore.create({
            clientId: validated.id,
            contractNumber: validated.contractNumber,
            contractDate: validated.contractDate ?? undefined,
            agentFee: validated.agentFee ?? undefined,
            fixedFee: validated.fixedFee ?? undefined,
            agentOrganizationId: validated.agentOrganizationId,
            agentOrganizationBankDetailsId:
              validated.agentOrganizationBankDetailsId,
          });
          await tx.contractStore.softDelete(existingContract.id);
          await tx.clientStore.update({
            id: validated.id,
            contractId: newContract.id,
          });

          this.runtime.log.info("Contract replaced for client", {
            clientId: validated.id,
            oldContractId: existingContract.id,
            newContractId: newContract.id,
          });
        } else {
          // Same contract number → update existing
          await tx.contractStore.update({
            id: existingContract.id,
            contractDate: validated.contractDate ?? undefined,
            agentFee: validated.agentFee ?? undefined,
            fixedFee: validated.fixedFee ?? undefined,
            agentOrganizationId: validated.agentOrganizationId,
            agentOrganizationBankDetailsId:
              validated.agentOrganizationBankDetailsId,
          });

          this.runtime.log.info("Contract updated for client", {
            clientId: validated.id,
            contractId: existingContract.id,
          });
        }
      }

      this.runtime.log.info("Client updated", { id: validated.id });

      return updated;
    });
  }
}

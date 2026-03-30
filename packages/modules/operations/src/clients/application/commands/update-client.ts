import type { ModuleRuntime } from "@bedrock/shared/core";

import { ClientNotFoundError } from "../../../errors";
import {
  UpdateClientInputSchema,
  type UpdateClientInput,
} from "../contracts/commands";
import type { ClientsCommandUnitOfWork } from "../ports/clients.uow";
import type { CounterpartiesPort } from "../ports/counterparties.port";

export class UpdateClientCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ClientsCommandUnitOfWork,
    private readonly counterparties?: CounterpartiesPort,
  ) {}

  async execute(input: UpdateClientInput) {
    const validated = UpdateClientInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.clientStore.findById(validated.id);
      if (!existing) {
        throw new ClientNotFoundError(validated.id);
      }

      let finalClient = await tx.clientStore.update(validated);

      const syncedCustomerId = await tx.customerBridge.ensureLinkedCustomer({
        customerId: finalClient?.customerId ?? existing.customerId,
        displayName: finalClient?.orgName ?? existing.orgName,
        legacyClientId: validated.id,
        nextCustomerId: existing.customerId ?? this.runtime.generateUuid(),
      });
      if ((finalClient?.customerId ?? existing.customerId) !== syncedCustomerId) {
        finalClient = await tx.clientStore.update({
          id: validated.id,
          customerId: syncedCustomerId,
        }) ?? finalClient;
      }

      if (this.counterparties) {
        const displayName = finalClient?.orgName ?? existing.orgName;
        const externalId = finalClient?.inn ?? existing.inn ?? null;
        const country = finalClient?.bankCountry ?? existing.bankCountry ?? null;
        const currentCounterpartyId =
          finalClient?.counterpartyId ?? existing.counterpartyId;

        if (currentCounterpartyId) {
          await this.counterparties.syncCustomerOwnedCounterparty({
            counterpartyId: currentCounterpartyId,
            country,
            customerId: syncedCustomerId,
            displayName,
            externalId,
          });
        } else {
          const createdCounterpartyId =
            await this.counterparties.createCustomerOwnedCounterparty({
              country,
              customerId: syncedCustomerId,
              displayName,
              externalId,
            });
          finalClient = await tx.clientStore.update({
            id: validated.id,
            counterpartyId: createdCounterpartyId,
          }) ?? finalClient;
        }
      }

      this.runtime.log.info("Client updated", { id: validated.id });

      return finalClient;
    });
  }
}

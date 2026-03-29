import type { ModuleRuntime } from "@bedrock/shared/core";

import { normalizeLocalizedField } from "../../../shared/domain/localized-text";
import {
  CreateClientInputSchema,
  type CreateClientInput,
} from "../contracts/commands";
import type { ClientsCommandUnitOfWork } from "../ports/clients.uow";
import type { CounterpartiesPort } from "../ports/counterparties.port";

export class CreateClientCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ClientsCommandUnitOfWork,
    private readonly counterparties?: CounterpartiesPort,
  ) {}

  async execute(input: CreateClientInput) {
    const validated = CreateClientInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      // Normalize i18n fields: ensure ru value is set from base field
      const normalized = {
        ...validated,
        orgNameI18n: normalizeLocalizedField(
          validated.orgName,
          validated.orgNameI18n,
        ),
        orgTypeI18n: normalizeLocalizedField(
          validated.orgType ?? null,
          validated.orgTypeI18n,
        ),
        directorNameI18n: normalizeLocalizedField(
          validated.directorName ?? null,
          validated.directorNameI18n,
        ),
        positionI18n: normalizeLocalizedField(
          validated.position ?? null,
          validated.positionI18n,
        ),
        directorBasisI18n: normalizeLocalizedField(
          validated.directorBasis ?? null,
          validated.directorBasisI18n,
        ),
        addressI18n: normalizeLocalizedField(
          validated.address ?? null,
          validated.addressI18n,
        ),
        bankNameI18n: normalizeLocalizedField(
          validated.bankName ?? null,
          validated.bankNameI18n,
        ),
        bankAddressI18n: normalizeLocalizedField(
          validated.bankAddress ?? null,
          validated.bankAddressI18n,
        ),
      };

      let counterpartyId: string | null =
        normalized.counterpartyId ?? null;

      const created = await tx.clientStore.create({
        ...normalized,
        counterpartyId,
      });
      const customerId = await tx.customerBridge.ensureLinkedCustomer({
        customerId: created.customerId,
        displayName: created.orgName,
        legacyClientId: created.id,
        nextCustomerId: this.runtime.generateUuid(),
      });
      const clientWithCustomer =
        created.customerId === customerId
          ? created
          : await tx.clientStore.update({
              id: created.id,
              customerId,
            });
      let shellClient = clientWithCustomer ?? created;

      if (this.counterparties) {
        if (counterpartyId) {
          await this.counterparties.syncCustomerOwnedCounterparty({
            counterpartyId,
            country: normalized.bankCountry ?? null,
            customerId,
            displayName: normalized.orgName,
            externalId: normalized.inn ?? null,
          });
        } else {
          counterpartyId =
            await this.counterparties.createCustomerOwnedCounterparty({
              country: normalized.bankCountry ?? null,
              customerId,
              displayName: normalized.orgName,
              externalId: normalized.inn ?? null,
            });
          shellClient =
            (await tx.clientStore.update({
              id: created.id,
              counterpartyId,
            })) ?? shellClient;
        }
      }

      // Auto-create contract if contract fields are provided
      if (
        validated.agentOrganizationId &&
        validated.agentOrganizationBankDetailsId
      ) {
        const contract = await tx.contractStore.create({
          clientId: created.id,
          contractNumber: validated.contractNumber ?? undefined,
          contractDate: validated.contractDate ?? undefined,
          agentFee: validated.agentFee ?? undefined,
          fixedFee: validated.fixedFee ?? undefined,
          agentOrganizationId: validated.agentOrganizationId,
          agentOrganizationBankDetailsId:
            validated.agentOrganizationBankDetailsId,
        });

        const withContract = await tx.clientStore.update({
          id: created.id,
          contractId: contract.id,
        });

        this.runtime.log.info("Contract auto-created for client", {
          clientId: created.id,
          contractId: contract.id,
        });

        this.runtime.log.info("Client created", {
          id: created.id,
          orgName: created.orgName,
          counterpartyId,
          customerId,
        });

        return withContract ?? shellClient;
      }

      this.runtime.log.info("Client created", {
        id: created.id,
        orgName: created.orgName,
        counterpartyId,
        customerId,
      });

      return shellClient;
    });
  }
}
